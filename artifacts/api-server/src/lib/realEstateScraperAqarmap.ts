import { RE_PRICES } from "@workspace/shared-data";
import { aggregatePrices, MIN_SAMPLE_SIZE, ScrapedAreaResult } from "./realEstateScraper";
import { logger } from "./logger";

// Same reasoning as realEstateScraper.ts's UA constant — present as an
// ordinary browser, not a bare server request.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Aqarmap gives each curated area its own dedicated listing page (see
// RE_PRICES's aqarmapPath field — hand-verified, not guessed; read that
// field's doc comment for what "verified" means here). That's a real
// advantage over Property Finder, which has no per-area page and had to be
// crawled as one big paginated pool with fuzzy text matching — the fuzzy
// matching left 57 of 65 areas empty most runs. A direct per-area page
// needs far fewer requests for far better coverage: 2 pages per area, only
// for areas with a verified path, not hundreds of pages hoping enough
// listings for a given area happen to show up in the sample.
const PAGES_PER_AREA = 2;
const PAGE_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Aqarmap is plain server-rendered HTML (no embedded JSON blob to parse,
// unlike Property Finder's __NEXT_DATA__), so prices are pulled from the
// rendered text directly: every price-per-m² figure on a listing card is
// immediately followed by the literal "EGP/m²" label, with nothing else in
// between once tags are stripped — confirmed by hand against real fetched
// pages before relying on it. Range-clamped so an unrelated "0 EGP/m²"
// placeholder or a wildly-off outlier can't corrupt the sample.
function extractPricesPerM2(html: string): number[] {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const textWithMarkers = noScripts.replace(/<[^>]+>/g, "|");
  const parts = textWithMarkers.split("|").map((p) => p.trim()).filter(Boolean);

  const prices: number[] = [];
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] !== "EGP/m²") continue;
    const raw = parts[i - 1].replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 3_000 && n <= 1_000_000) prices.push(n);
  }
  return prices;
}

async function fetchAreaPage(path: string, page: number): Promise<string | null> {
  const url = `https://aqarmap.com.eg${path}${page > 1 ? `?page=${page}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    logger.warn({ err, url }, "Aqarmap area fetch failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrapes real per-area prices from Aqarmap for every RE_PRICES entry that
 * has a hand-verified aqarmapPath. Returns a Map the same shape as
 * realEstateScraper.ts's area map, meant to be merged over (takes priority
 * over) the Property Finder result for any area both cover — a direct,
 * verified per-area page is a stronger source than fuzzy breadcrumb
 * matching against a general listings pool.
 */
export async function scrapeAqarmapAreaPrices(): Promise<Map<string, ScrapedAreaResult>> {
  const results = new Map<string, ScrapedAreaResult>();
  const targets = RE_PRICES.filter((a) => a.aqarmapPath);

  for (const area of targets) {
    const prices: number[] = [];
    for (let page = 1; page <= PAGES_PER_AREA; page++) {
      const html = await fetchAreaPage(area.aqarmapPath!, page);
      if (html) prices.push(...extractPricesPerM2(html));
      await sleep(PAGE_DELAY_MS);
    }

    if (prices.length < MIN_SAMPLE_SIZE) {
      logger.warn({ areaId: area.id, n: prices.length }, "Aqarmap area: below minimum sample size, skipping");
      continue;
    }
    results.set(area.id, aggregatePrices(prices));
  }

  logger.info({ areasMatched: results.size, areasTargeted: targets.length }, "Aqarmap area scrape: run complete");
  return results;
}
