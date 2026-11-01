import { and, desc, eq, lte } from "drizzle-orm";
import {
  db,
  realEstatePricesTable,
  realEstateCompoundPricesTable,
  realEstatePriceHistoryTable,
} from "@workspace/db";
import {
  RE_PRICES,
  RE_COMPOUNDS,
  AQARMAP_AREA_SOURCES,
  AQARMAP_COMPOUND_SOURCES,
  priceBasisForArea,
  priceBasisForCompound,
} from "@workspace/shared-data";
import { scrapeRealEstatePrices, ScrapedAreaResult } from "./realEstateScraper";
import { scrapeAqarmapSources } from "./realEstateScraperAqarmap";
import { cairoDateString } from "./cairoDate";
import { logger } from "./logger";

// 12h — twice a day, not more. Real estate prices don't move fast enough to
// justify continuous polling, and infrequent, spread-out requests are far
// less likely to trip the listing sites' bot protection.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

// A same-source, same-basis price moving more than this in one run on a
// small sample is far likelier a bad scrape than a real market move — keep
// the previous value and log it instead of publishing the jump.
const MAX_JUMP = 0.35;
const JUMP_TRUSTED_SAMPLE = 30;

// "Change %" compares against the price about this long ago, from the same
// source — a 12h-to-12h comparison was noise, and comparing across sources
// showed fake moves whenever the source switched.
const CHANGE_LOOKBACK_DAYS = 30;

let running = false;

type Kind = "area" | "compound";
type Source = "aqarmap" | "property_finder";

interface Target {
  kind: Kind;
  id: string;
  basis: string;
}

async function currentRow(t: Target) {
  if (t.kind === "area") {
    const [row] = await db
      .select({ avg: realEstatePricesTable.avgPricePerM2, source: realEstatePricesTable.source, basis: realEstatePricesTable.priceBasis })
      .from(realEstatePricesTable)
      .where(eq(realEstatePricesTable.id, t.id));
    return row;
  }
  const [row] = await db
    .select({ avg: realEstateCompoundPricesTable.avgPricePerM2, source: realEstateCompoundPricesTable.source, basis: realEstateCompoundPricesTable.priceBasis })
    .from(realEstateCompoundPricesTable)
    .where(eq(realEstateCompoundPricesTable.id, t.id));
  return row;
}

async function changeVsLookback(t: Target, avg: number, source: Source, today: string): Promise<number | null> {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - CHANGE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [past] = await db
    .select({ avg: realEstatePriceHistoryTable.avgPricePerM2, basis: realEstatePriceHistoryTable.priceBasis })
    .from(realEstatePriceHistoryTable)
    .where(and(
      eq(realEstatePriceHistoryTable.kind, t.kind),
      eq(realEstatePriceHistoryTable.refId, t.id),
      eq(realEstatePriceHistoryTable.source, source),
      lte(realEstatePriceHistoryTable.day, cutoff),
    ))
    .orderBy(desc(realEstatePriceHistoryTable.day))
    .limit(1);
  if (!past || past.basis !== t.basis || past.avg <= 0) return null;
  return ((avg - past.avg) / past.avg) * 100;
}

/** Writes one successful scrape. Returns false if the value was rejected. */
async function record(t: Target, result: ScrapedAreaResult, source: Source, today: string): Promise<boolean> {
  try {
    const existing = await currentRow(t);
    if (
      existing && existing.source === source && existing.basis === t.basis && existing.avg > 0 &&
      result.sampleSize < JUMP_TRUSTED_SAMPLE &&
      Math.abs(result.avgPricePerM2 - existing.avg) / existing.avg > MAX_JUMP
    ) {
      logger.warn(
        { kind: t.kind, id: t.id, previous: existing.avg, scraped: result.avgPricePerM2, n: result.sampleSize, source },
        "Real estate price: implausible jump on a small sample — keeping previous value",
      );
      return false;
    }

    await db
      .insert(realEstatePriceHistoryTable)
      .values({
        id: `${t.kind}:${t.id}:${today}`,
        kind: t.kind,
        refId: t.id,
        day: today,
        avgPricePerM2: result.avgPricePerM2,
        minPricePerM2: result.minPricePerM2,
        maxPricePerM2: result.maxPricePerM2,
        sampleSize: result.sampleSize,
        source,
        priceBasis: t.basis,
      })
      .onConflictDoUpdate({
        target: realEstatePriceHistoryTable.id,
        set: {
          avgPricePerM2: result.avgPricePerM2,
          minPricePerM2: result.minPricePerM2,
          maxPricePerM2: result.maxPricePerM2,
          sampleSize: result.sampleSize,
          source,
          priceBasis: t.basis,
        },
      });

    const changePercent = await changeVsLookback(t, result.avgPricePerM2, source, today);
    const values = {
      minPricePerM2: result.minPricePerM2,
      maxPricePerM2: result.maxPricePerM2,
      avgPricePerM2: result.avgPricePerM2,
      changePercent,
      sampleSize: result.sampleSize,
      source,
      priceBasis: t.basis,
      updatedAt: new Date(),
    };

    if (t.kind === "area") {
      const area = RE_PRICES.find((a) => a.id === t.id)!;
      await db
        .insert(realEstatePricesTable)
        .values({ id: area.id, governorate: area.governorate, area: area.area, type: area.type, ...values })
        .onConflictDoUpdate({ target: realEstatePricesTable.id, set: values });
    } else {
      const c = RE_COMPOUNDS.find((x) => x.id === t.id)!;
      await db
        .insert(realEstateCompoundPricesTable)
        .values({
          id: c.id, name: c.name, developer: c.developer, governorate: c.governorate,
          areaId: c.areaId ?? null, type: c.type, ...values,
        })
        .onConflictDoUpdate({
          target: realEstateCompoundPricesTable.id,
          // Curated name/developer/area can be corrected over time.
          set: { ...values, name: c.name, developer: c.developer, governorate: c.governorate, areaId: c.areaId ?? null },
        });
    }
    return true;
  } catch (err) {
    logger.warn({ err, kind: t.kind, id: t.id }, "Real estate price: failed to record");
    return false;
  }
}

// The server restarts often (deploys, free-tier sleep), and every boot
// starts a run — skip it when the last one wrote recently, so restarts don't
// re-scrape the listing sites again and again.
const MIN_GAP_MS = 11 * 60 * 60 * 1000;

async function ranRecently(): Promise<boolean> {
  const [latest] = await db
    .select({ updatedAt: realEstatePricesTable.updatedAt })
    .from(realEstatePricesTable)
    .orderBy(desc(realEstatePricesTable.updatedAt))
    .limit(1);
  return !!latest && Date.now() - latest.updatedAt.getTime() < MIN_GAP_MS;
}

async function runScrape(): Promise<void> {
  if (running) return; // guard against overlap if a prior run is still in flight
  running = true;
  const today = cairoDateString();
  try {
    if (await ranRecently()) {
      logger.info("Real estate price run skipped — prices were refreshed recently");
      return;
    }
    // Aqarmap first, written as soon as it finishes: it's the primary source
    // (verified per-location pages) and the faster run, so a server restart
    // during the slow Property Finder pass doesn't lose it.
    const aqAreas = await scrapeAqarmapSources(AQARMAP_AREA_SOURCES, "areas");
    const aqCompounds = await scrapeAqarmapSources(AQARMAP_COMPOUND_SOURCES, "compounds");
    let written = 0;
    for (const area of RE_PRICES) {
      const r = aqAreas.get(area.id);
      if (r && await record({ kind: "area", id: area.id, basis: priceBasisForArea(area) }, r, "aqarmap", today)) written++;
    }
    for (const c of RE_COMPOUNDS) {
      const r = aqCompounds.get(c.id);
      if (r && await record({ kind: "compound", id: c.id, basis: priceBasisForCompound(c) }, r, "aqarmap", today)) written++;
    }

    // Property Finder only fills what Aqarmap couldn't price this run.
    const pf = await scrapeRealEstatePrices();

    // Not used for pricing — a monitoring signal. The two sites define some
    // areas differently (Property Finder's area pages include compound
    // units), so some gap is expected; a very large one is worth a look.
    for (const [id, a] of aqAreas) {
      const p = pf.areas.get(id);
      if (p && Math.abs(p.avgPricePerM2 - a.avgPricePerM2) / a.avgPricePerM2 > 0.4) {
        logger.info({ id, aqarmap: a.avgPricePerM2, propertyFinder: p.avgPricePerM2, nAq: a.sampleSize, nPf: p.sampleSize }, "Real estate price: sources disagree by >40%");
      }
    }
    for (const area of RE_PRICES) {
      if (aqAreas.has(area.id)) continue;
      const r = pf.areas.get(area.id);
      if (r && await record({ kind: "area", id: area.id, basis: priceBasisForArea(area) }, r, "property_finder", today)) written++;
    }
    for (const c of RE_COMPOUNDS) {
      if (aqCompounds.has(c.id)) continue;
      const r = pf.compounds.get(c.id);
      if (r && await record({ kind: "compound", id: c.id, basis: priceBasisForCompound(c) }, r, "property_finder", today)) written++;
    }

    // Anything not priced this run keeps its last good value and date —
    // the API marks it stale once it's old, rather than it disappearing
    // after one bad run.
    logger.info(
      {
        written,
        areasAqarmap: aqAreas.size,
        areasPropertyFinder: [...pf.areas.keys()].filter((id) => !aqAreas.has(id)).length,
        compoundsAqarmap: aqCompounds.size,
        compoundsPropertyFinder: [...pf.compounds.keys()].filter((id) => !aqCompounds.has(id)).length,
      },
      "Real estate price run complete",
    );
  } catch (err) {
    logger.warn({ err }, "Real estate price cron run failed");
  } finally {
    running = false;
  }
}

export function startRealEstatePriceCron(): void {
  runScrape();
  setInterval(runScrape, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Real estate price cron started");
}
