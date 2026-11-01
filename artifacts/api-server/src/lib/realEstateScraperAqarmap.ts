import type { AqarmapSource } from "@workspace/shared-data";
import { aggregatePrices, MIN_SAMPLE_SIZE, ScrapedAreaResult } from "./realEstateScraper";
import { logger } from "./logger";

// Same reasoning as realEstateScraper.ts's UA constant — present as an
// ordinary browser, not a bare server request.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ~22 listings per page. A single-path target reads up to 3 pages (~66
// listings); a multi-path target (e.g. 5th Settlement, built from its core
// districts) reads 1 page per path, since the paths already add breadth.
const MAX_PAGES_SINGLE_PATH = 3;
const MAX_PAGES_MULTI_PATH = 1;
const PAGE_DELAY_MS = 1200;
const RETRY_DELAY_MS = 6000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PageResult {
  /** False when the page couldn't be used. */
  ok: boolean;
  /** "missing": Aqarmap redirected away from the requested location — it
   *  silently serves the parent area for an unknown slug, which would
   *  attribute the parent's prices to this location. "error": a timeout or
   *  network failure, worth one retry. */
  failure?: "missing" | "error";
  /** Listing cards as [dedupe key, price per m²]. */
  listings: Array<[string, number]>;
  /** The page's own "N Apartments For sale" total, when present. */
  total: number | null;
}

// Aqarmap is server-rendered HTML. On each listing card the total price
// and the price per m² sit next to each other once tags are stripped:
// "5,525,000 EGP" "–" "25,938" "EGP/m²". The per-m² figure is Aqarmap's own
// (price ÷ the card's area), so it's taken as-is. The total price is kept
// only to de-duplicate cards repeated across pages (promoted listings).
function extractListings(html: string): Array<[string, number]> {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const parts = noScripts.replace(/<[^>]+>/g, "|").split("|").map((p) => p.trim()).filter(Boolean);
  const out: Array<[string, number]> = [];
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] !== "EGP/m²") continue;
    const perM2 = Number(parts[i - 1].replace(/,/g, ""));
    if (!Number.isFinite(perM2) || perM2 < 3_000 || perM2 > 1_000_000) continue;
    const totalLabel = i >= 3 ? parts[i - 3] : "";
    out.push([`${totalLabel}|${perM2}`, perM2]);
  }
  return out;
}

async function fetchPage(unit: string, path: string, page: number): Promise<PageResult> {
  const requested = `/en/for-sale/${unit}${path}`;
  const url = `https://aqarmap.com.eg${requested}${page > 1 ? `?page=${page}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) return { ok: false, failure: res.status === 404 ? "missing" : "error", listings: [], total: null };
    const finalPath = new URL(res.url).pathname;
    if (finalPath !== requested) return { ok: false, failure: "missing", listings: [], total: null };
    const html = await res.text();
    const totalMatch = html.match(/<title>[^<]*?- ([\d,]+) [A-Z]/);
    return {
      ok: true,
      listings: extractListings(html),
      total: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null,
    };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err, url }, "Aqarmap page fetch failed");
    return { ok: false, failure: "error", listings: [], total: null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrapes a price per m² for each source (an area or a compound): every
 * path's first pages, de-duplicated, then the shared trim + median. Entries
 * under MIN_SAMPLE_SIZE are left out — the caller keeps their last good
 * value rather than publishing a number built on a handful of listings.
 */
export async function scrapeAqarmapSources(
  sources: Record<string, AqarmapSource>,
  label: string,
): Promise<Map<string, ScrapedAreaResult>> {
  const results = new Map<string, ScrapedAreaResult>();
  let brokenPaths = 0;

  for (const [id, source] of Object.entries(sources)) {
    const seen = new Map<string, number>();
    const maxPages = source.paths.length > 1 ? MAX_PAGES_MULTI_PATH : MAX_PAGES_SINGLE_PATH;

    for (const path of source.paths) {
      // A location with few (or zero) matching listings pads its page with
      // "similar" listings from other places — confirmed live: a compound
      // with 0 apartments still rendered 50 prices. Only the first `total`
      // cards belong to this location, so never take more than that.
      let remaining = Infinity;
      for (let page = 1; page <= maxPages && remaining > 0; page++) {
        let result = await fetchPage(source.unit, path, page);
        await sleep(PAGE_DELAY_MS);
        if (!result.ok && result.failure === "error") {
          await sleep(RETRY_DELAY_MS);
          result = await fetchPage(source.unit, path, page);
          await sleep(PAGE_DELAY_MS);
        }
        if (!result.ok) {
          if (page === 1) {
            brokenPaths++;
            logger.warn({ id, path, unit: source.unit, failure: result.failure }, "Aqarmap: location page unusable this run — skipping path");
          }
          break;
        }
        if (page === 1) {
          // No readable total means the page can't be trusted to be only this location.
          if (result.total == null) break;
          remaining = result.total;
        }
        const own = result.listings.slice(0, remaining);
        remaining -= own.length;
        const before = seen.size;
        for (const [key, price] of own) seen.set(key, price);
        if (seen.size === before) break;
      }
    }

    if (seen.size < MIN_SAMPLE_SIZE) continue;
    results.set(id, aggregatePrices([...seen.values()]));
  }

  logger.info(
    { label, matched: results.size, targeted: Object.keys(sources).length, brokenPaths },
    "Aqarmap scrape: run complete",
  );
  return results;
}
