import { RE_PRICES, REAreaPrice, RE_COMPOUNDS, RECompound } from "@workspace/shared-data";
import { logger } from "./logger";

// Requests with no User-Agent from a cloud datacenter IP are exactly what a
// bot-blocker flags first (same reasoning as markets.ts's WISE_HEADERS) —
// Property Finder runs AWS WAF with CAPTCHA-challenge capability, confirmed
// present on their pages, so presenting as an ordinary browser is the
// minimum needed to not be an obvious bot on the very first request.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Property Finder has no per-area "price index" page — the general search
// results are the only source, paginated. 250 pages * 25/page = ~6,250
// listings sampled per run, spread across as many of the 65 tracked areas
// and 44 tracked compounds as show up in that sample. High-volume areas
// (New Cairo, Sheikh Zayed, North Coast) get plenty of listings; low-volume
// areas/compounds may get few or none — those just keep their previous
// value that run (see realEstatePriceCron.ts), not zeroed out or guessed.
// Bumped from 150 to 250 when compound-level tracking was added: compounds
// are a strict subset of the same sampled pool (only listings tagged
// location.type === "COMPOUND"), so a smaller page count left most curated
// compounds under MIN_SAMPLE_SIZE most runs.
const MAX_PAGES = 250;
// Spreads the whole run over ~4-5 minutes instead of firing 150 requests
// back to back — this plus the cron's 12h interval (real-estate-price-cron.ts)
// is the actual mitigation for the WAF/blocking risk, not a guarantee.
const PAGE_DELAY_MS = 1800;
// Fewer matched listings than this isn't trustworthy enough to overwrite a
// previous value. Raised from 3 to 8 after a real check against Property
// Finder: El Gouna's n=5 sample averaged 232K/m² because two genuine but
// ultra-luxury villa listings (337K/m², 174K/m² — both verified real, not a
// bug) dominated a tiny sample. 8 gives the median below more to work with
// before a couple of outlier mansions can define the whole number.
const MIN_SAMPLE_SIZE = 8;

interface ScrapedListing {
  pricePerM2: number;
  pathName: string; // e.g. "Cairo, New Cairo City, The 5th Settlement, 5th Settlement Compounds"
  locationType?: string; // e.g. "COMPOUND" — siblings of pathName on the same property.location object, no extra request needed
  locationName?: string; // e.g. "Piacera", "Swan Lake"
}

export interface ScrapedAreaResult {
  avgPricePerM2: number;
  minPricePerM2: number;
  maxPricePerM2: number;
  sampleSize: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchListingsPage(page: number): Promise<ScrapedListing[]> {
  const url = `https://www.propertyfinder.eg/en/buy/properties-for-sale.html?page=${page}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) return [];
    const html = await res.text();
    // Property Finder is server-rendered Next.js — the page's own data is
    // embedded directly in the HTML as JSON, no separate API endpoint to
    // call and no HTML/DOM parsing library needed (confirmed by direct
    // inspection: no cheerio/jsdom dependency exists in this codebase, and
    // this needs none).
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const listings: any[] = data?.props?.pageProps?.searchResult?.listings ?? [];
    const out: ScrapedListing[] = [];
    for (const l of listings) {
      const p = l?.property;
      const pricePerM2 = p?.price_per_area?.price;
      const pathName = p?.location?.path_name;
      if (typeof pricePerM2 === "number" && pricePerM2 > 0 && typeof pathName === "string") {
        out.push({
          pricePerM2,
          pathName,
          locationType: typeof p?.location?.type === "string" ? p.location.type : undefined,
          locationName: typeof p?.location?.name === "string" ? p.location.name : undefined,
        });
      }
    }
    return out;
  } catch (err) {
    logger.warn({ page, err: err instanceof Error ? err.message : err }, "Real estate scrape: page fetch failed");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[—-]/g, " ").replace(/\s+/g, " ").trim();
}

// Buckets a scraped listing into one of the 65 static areas by checking
// whether the area's name (and, for areas with a qualifier after an
// em-dash like "New Cairo — 5th Settlement", that qualifier too) appears in
// the listing's location breadcrumb. This is a curated heuristic, not exact
// matching — good enough to bucket real listings per area without needing
// to reverse-engineer Property Finder's internal location-ID scheme for
// all 65 areas individually.
function matchesArea(pathName: string, area: REAreaPrice): boolean {
  const p = normalize(pathName);
  const [base, qualifier] = area.area.split("—").map((s) => (s ? normalize(s) : undefined));
  if (!base || !p.includes(base)) return false;
  if (qualifier && !p.includes(qualifier)) return false;
  return true;
}

// Matches on Property Finder's own structured location.type/location.name
// fields rather than breadcrumb substrings — more precise than matchesArea
// since it's an exact field, not a heuristic, so no qualifier-splitting
// logic is needed here.
function matchesCompound(listing: ScrapedListing, compound: RECompound): boolean {
  if (listing.locationType !== "COMPOUND" || !listing.locationName) return false;
  const name = normalize(listing.locationName);
  const candidates = [compound.name, ...(compound.aliases ?? [])].map(normalize);
  return candidates.includes(name);
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Shared by both area- and compound-level bucketing — trims the outer ~5%
// on each side (cheap outlier protection against a single mis-tagged
// luxury/distressed listing skewing a small sample) and computes min/max.
// avgPricePerM2 is the MEDIAN of the trimmed set, not the mean — real
// estate listing prices are heavily right-skewed (a handful of ultra-luxury
// villas can sit at 5-10x a "typical" unit in the same area), and a mean
// gets pulled toward those outliers hard, especially at the smaller sample
// sizes this scraper often works with. Median reports what a typical
// matched listing actually costs, not what the presence of one mansion
// implies. min/max stay real, untouched extremes — worth showing as the
// actual range, not something to "fix."
function aggregate(matched: ScrapedListing[]): ScrapedAreaResult {
  const prices = matched.map((l) => l.pricePerM2).sort((a, b) => a - b);
  const trimCount = Math.floor(prices.length * 0.05);
  const trimmed = trimCount > 0 ? prices.slice(trimCount, prices.length - trimCount) : prices;
  return {
    avgPricePerM2: Math.round(median(trimmed)),
    minPricePerM2: Math.round(trimmed[0]),
    maxPricePerM2: Math.round(trimmed[trimmed.length - 1]),
    sampleSize: matched.length,
  };
}

export interface ScrapeResults {
  areas: Map<string, ScrapedAreaResult>;
  compounds: Map<string, ScrapedAreaResult>;
}

export async function scrapeRealEstatePrices(): Promise<ScrapeResults> {
  const allListings: ScrapedListing[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const listings = await fetchListingsPage(page);
    allListings.push(...listings);
    await sleep(PAGE_DELAY_MS);
  }
  logger.info({ totalListings: allListings.length, pages: MAX_PAGES }, "Real estate scrape: fetched listings");

  const areas = new Map<string, ScrapedAreaResult>();
  for (const area of RE_PRICES) {
    const matched = allListings.filter((l) => matchesArea(l.pathName, area));
    if (matched.length < MIN_SAMPLE_SIZE) continue;
    areas.set(area.id, aggregate(matched));
  }

  const compounds = new Map<string, ScrapedAreaResult>();
  for (const compound of RE_COMPOUNDS) {
    const matched = allListings.filter((l) => matchesCompound(l, compound));
    if (matched.length < MIN_SAMPLE_SIZE) continue;
    compounds.set(compound.id, aggregate(matched));
  }

  return { areas, compounds };
}
