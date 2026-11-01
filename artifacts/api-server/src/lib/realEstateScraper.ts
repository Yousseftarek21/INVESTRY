import { RE_PRICES, REAreaPrice, RE_COMPOUNDS, RECompound, priceBasisForArea, priceBasisForCompound, type PriceBasis } from "@workspace/shared-data";
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
export const MIN_SAMPLE_SIZE = 8;

interface ScrapedListing {
  id: string;
  pricePerM2: number;
  propertyType?: string; // e.g. "Apartment", "Chalet", "Villa", "Townhouse"
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
          id: String(p?.id ?? l?.id ?? `${pathName}|${pricePerM2}`),
          pricePerM2,
          propertyType: typeof p?.property_type === "string" ? p.property_type : undefined,
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

// Looser form for area names only: listing sites and our list spell the
// same place differently ("Al Rehab City" vs "Rehab", "El Shorouk" vs
// "Shorouk City", "The 5th Settlement" vs "5th Settlement").
function normalizeName(s: string): string {
  return ` ${s.toLowerCase().replace(/[—,\-()]/g, " ")} `
    .replace(/ (el|al|the|city) /g, " ")
    .replace(/ (el|al|the|city) /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Which Property Finder property types count toward each price basis — an
// apartment area's price must not be pulled up by villas or down by land.
const PF_TYPES: Record<PriceBasis, string[]> = {
  apartment: ["apartment", "duplex", "penthouse", "studio", "hotel apartment", "roof"],
  chalet: ["chalet", "apartment", "duplex", "penthouse"],
  villa: ["villa", "townhouse", "twin house", "ivilla"],
};

function typeMatches(listing: ScrapedListing, basis: PriceBasis): boolean {
  if (!listing.propertyType) return false;
  return PF_TYPES[basis].includes(listing.propertyType.toLowerCase());
}

// Buckets a scraped listing into one of the 65 static areas by checking
// whether the area's name (and, for areas with a qualifier after an
// em-dash like "New Cairo — 5th Settlement", that qualifier too) appears in
// the listing's location breadcrumb. This is a curated heuristic, not exact
// matching — good enough to bucket real listings per area without needing
// to reverse-engineer Property Finder's internal location-ID scheme for
// all 65 areas individually.
// Returns the length of the matched name (0 = no match) so a listing that
// matches several areas goes to the most specific one — "New Mansoura"
// listings also contain "Mansoura", and must not count toward Mansoura.
function areaMatchScore(pathName: string, area: REAreaPrice): number {
  const p = ` ${normalizeName(pathName)} `;
  let best = 0;
  // "Zayed 2 / Beverly Hills" — either spelling identifies the area.
  for (const alt of area.area.split("/")) {
    const [base = "", qualifier = ""] = alt.split("—").map((s) => normalizeName(s));
    if (!base || !p.includes(` ${base} `)) continue;
    if (qualifier && !p.includes(` ${qualifier} `)) continue;
    best = Math.max(best, base.length + qualifier.length);
  }
  return best;
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
// Exported so realEstateScraperAqarmap.ts's per-area listing pages can use
// the identical trim/median logic on their own raw price arrays — same
// reasoning, same outlier protection, one implementation.
export function aggregatePrices(prices: number[]): ScrapedAreaResult {
  const sorted = [...prices].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.05);
  const trimmed = trimCount > 0 ? sorted.slice(trimCount, sorted.length - trimCount) : sorted;
  return {
    avgPricePerM2: Math.round(median(trimmed)),
    minPricePerM2: Math.round(trimmed[0]),
    maxPricePerM2: Math.round(trimmed[trimmed.length - 1]),
    sampleSize: prices.length,
  };
}

function aggregate(matched: ScrapedListing[]): ScrapedAreaResult {
  return aggregatePrices(matched.map((l) => l.pricePerM2));
}

export interface ScrapeResults {
  areas: Map<string, ScrapedAreaResult>;
  compounds: Map<string, ScrapedAreaResult>;
}

export async function scrapeRealEstatePrices(maxPages: number = MAX_PAGES): Promise<ScrapeResults> {
  const allListings: ScrapedListing[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const listings = await fetchListingsPage(page);
    allListings.push(...listings);
    await sleep(PAGE_DELAY_MS);
  }
  logger.info({ totalListings: allListings.length, pages: maxPages }, "Property Finder scrape: fetched listings");

  // Featured listings repeat across pages — count each listing once.
  const unique = [...new Map(allListings.map((l) => [l.id, l])).values()];

  const byArea = new Map<string, ScrapedListing[]>();
  for (const listing of unique) {
    let bestArea: REAreaPrice | null = null;
    let bestScore = 0;
    for (const area of RE_PRICES) {
      const score = areaMatchScore(listing.pathName, area);
      if (score > bestScore) { bestScore = score; bestArea = area; }
    }
    if (!bestArea || !typeMatches(listing, priceBasisForArea(bestArea))) continue;
    const list = byArea.get(bestArea.id) ?? [];
    list.push(listing);
    byArea.set(bestArea.id, list);
  }

  const areas = new Map<string, ScrapedAreaResult>();
  for (const [id, matched] of byArea) {
    if (matched.length >= MIN_SAMPLE_SIZE) areas.set(id, aggregate(matched));
  }

  const compounds = new Map<string, ScrapedAreaResult>();
  for (const compound of RE_COMPOUNDS) {
    const basis = priceBasisForCompound(compound);
    const matched = unique.filter((l) => matchesCompound(l, compound) && typeMatches(l, basis));
    if (matched.length < MIN_SAMPLE_SIZE) continue;
    compounds.set(compound.id, aggregate(matched));
  }

  return { areas, compounds };
}
