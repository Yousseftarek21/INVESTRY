import { eq } from "drizzle-orm";
import { db, realEstatePricesTable, realEstateCompoundPricesTable } from "@workspace/db";
import { RE_PRICES, RE_COMPOUNDS } from "@workspace/shared-data";
import { scrapeRealEstatePrices, ScrapedAreaResult } from "./realEstateScraper";
import { scrapeAqarmapAreaPrices } from "./realEstateScraperAqarmap";
import { logger } from "./logger";

// 12h — twice a day, not more. Real estate prices don't move fast enough to
// justify continuous polling, and infrequent, spread-out requests are far
// less likely to trip Property Finder's bot protection than steady
// polling would be (see realEstateScraper.ts for the WAF context). Change
// to 24 * 60 * 60 * 1000 for once/day if twice feels unnecessary once this
// has run for a while.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

let running = false;

async function upsertArea(
  id: string, governorate: string, area: string, type: string,
  result: ScrapedAreaResult, source: string,
): Promise<void> {
  try {
    const [existing] = await db
      .select({ avgPricePerM2: realEstatePricesTable.avgPricePerM2 })
      .from(realEstatePricesTable)
      .where(eq(realEstatePricesTable.id, id));

    const changePercent = existing
      ? ((result.avgPricePerM2 - existing.avgPricePerM2) / existing.avgPricePerM2) * 100
      : null; // no prior scrape to compare against yet

    await db
      .insert(realEstatePricesTable)
      .values({
        id, governorate, area,
        minPricePerM2: result.minPricePerM2,
        maxPricePerM2: result.maxPricePerM2,
        avgPricePerM2: result.avgPricePerM2,
        changePercent,
        sampleSize: result.sampleSize,
        type,
        source,
      })
      .onConflictDoUpdate({
        target: realEstatePricesTable.id,
        set: {
          minPricePerM2: result.minPricePerM2,
          maxPricePerM2: result.maxPricePerM2,
          avgPricePerM2: result.avgPricePerM2,
          changePercent,
          sampleSize: result.sampleSize,
          source,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    logger.warn({ err, areaId: id }, "Real estate price cron: failed to upsert area");
  }
}

async function deleteStaleArea(id: string): Promise<void> {
  try {
    await db.delete(realEstatePricesTable).where(eq(realEstatePricesTable.id, id));
  } catch (err) {
    logger.warn({ err, areaId: id }, "Real estate price cron: failed to clear stale area");
  }
}

async function runScrape(): Promise<void> {
  if (running) return; // guard against overlap if a prior run is still in flight
  running = true;
  try {
    // Aqarmap first, and written to the DB immediately after its own scrape
    // finishes — not merged with Property Finder's result first and written
    // only once both are done. Aqarmap's run is ~90s (32 areas x 2 pages)
    // against Property Finder's ~7.5min (250 pages); every git push
    // restarts this server (a real, recurring issue for this cron), so if a
    // restart lands during the slow Property Finder pass, Aqarmap's already-
    // computed results are safely on disk rather than lost with everything
    // still sitting in memory.
    const aqAreas = await scrapeAqarmapAreaPrices();
    logger.info({ areasMatched: aqAreas.size, areasTargeted: RE_PRICES.filter(a => a.aqarmapPath).length }, "Aqarmap area scrape: writing results");
    for (const area of RE_PRICES) {
      const result = aqAreas.get(area.id);
      if (result) await upsertArea(area.id, area.governorate, area.area, area.type, result, "aqarmap");
    }

    const { areas: pfAreas, compounds } = await scrapeRealEstatePrices();
    logger.info(
      { areasFromPropertyFinder: pfAreas.size, areasTotal: RE_PRICES.length, compoundsMatched: compounds.size, compoundsTotal: RE_COMPOUNDS.length },
      "Real estate scrape: run complete",
    );

    for (const area of RE_PRICES) {
      // Aqarmap already wrote this area above and is the stronger source
      // (a direct, hand-verified per-area page vs. fuzzy breadcrumb
      // matching against one general pool) — never let a weaker Property
      // Finder match overwrite it.
      if (aqAreas.has(area.id)) continue;

      const result = pfAreas.get(area.id);
      // Not enough listings matched this area this run — delete any
      // existing row instead of leaving it stale. A prior run's row was
      // only ever written because it met MIN_SAMPLE_SIZE at the time; if
      // this run doesn't (fewer live listings now, or the threshold itself
      // was raised since), it stops being trustworthy "live" data and the
      // API route's fallback to the static file takes over instead of
      // silently keeping showing an old, possibly-outdated number forever.
      if (!result) { await deleteStaleArea(area.id); continue; }
      await upsertArea(area.id, area.governorate, area.area, area.type, result, "property_finder");
    }

    for (const compound of RE_COMPOUNDS) {
      const result = compounds.get(compound.id);
      // Same reasoning as the area loop above — a compound that no longer
      // meets MIN_SAMPLE_SIZE reverts to the honest area-estimate fallback
      // (GET /markets/real-estate/compounds) instead of keeping a stale row.
      if (!result) {
        try {
          await db.delete(realEstateCompoundPricesTable).where(eq(realEstateCompoundPricesTable.id, compound.id));
        } catch (err) {
          logger.warn({ err, compoundId: compound.id }, "Real estate price cron: failed to clear stale compound");
        }
        continue;
      }

      try {
        const [existing] = await db
          .select({ avgPricePerM2: realEstateCompoundPricesTable.avgPricePerM2 })
          .from(realEstateCompoundPricesTable)
          .where(eq(realEstateCompoundPricesTable.id, compound.id));

        const changePercent = existing
          ? ((result.avgPricePerM2 - existing.avgPricePerM2) / existing.avgPricePerM2) * 100
          : null;

        await db
          .insert(realEstateCompoundPricesTable)
          .values({
            id: compound.id,
            name: compound.name,
            developer: compound.developer,
            governorate: compound.governorate,
            areaId: compound.areaId ?? null,
            minPricePerM2: result.minPricePerM2,
            maxPricePerM2: result.maxPricePerM2,
            avgPricePerM2: result.avgPricePerM2,
            changePercent,
            sampleSize: result.sampleSize,
            type: compound.type,
            source: "property_finder",
          })
          .onConflictDoUpdate({
            target: realEstateCompoundPricesTable.id,
            set: {
              minPricePerM2: result.minPricePerM2,
              maxPricePerM2: result.maxPricePerM2,
              avgPricePerM2: result.avgPricePerM2,
              changePercent,
              sampleSize: result.sampleSize,
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        logger.warn({ err, compoundId: compound.id }, "Real estate price cron: failed to upsert compound");
      }
    }
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
