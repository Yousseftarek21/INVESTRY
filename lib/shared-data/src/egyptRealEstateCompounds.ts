import { REPropertyType } from "./egyptRealEstatePrices";

// Curated compound/developer reference list — deliberately NOT exhaustive.
// There are thousands of real developments in Egypt; most have too little
// Property Finder listing volume to ever accumulate a trustworthy live
// sample. This list favors developments that are both well-known AND
// weighted toward the high-liquidity areas (New Cairo, Sheikh Zayed, 6th of
// October, New Capital, North Coast, Red Sea) where Property Finder's
// listing volume is actually concentrated — that's what lets the live half
// of this feature light up for most entries instead of sitting permanently
// on the fallback.
//
// Deliberately NO price fields here — realEstateScraper.ts attaches live
// pricing separately (real_estate_compound_prices table). Every name and
// developer below is a real, existing development; entries were kept out
// rather than padded to hit a round number where the name/developer pairing
// wasn't confidently known.
//
// `areaId` links to a lib/shared-data/egyptRealEstatePrices.ts entry —
// used by GET /markets/real-estate/compounds to fall back to that area's
// own genuine price when a compound hasn't been scraped yet, instead of
// showing a fabricated compound-specific number.

export interface RECompound {
  id: string;
  name: string;
  developer: string;
  governorate: string;
  areaId?: string;
  type: REPropertyType;
  aliases?: string[]; // alternate names Property Finder's location.name may use
}

export const RE_COMPOUNDS: RECompound[] = [
  // ── Palm Hills Developments ─────────────────────────────────────────────
  { id: 'palm-hills-katameya', name: 'Palm Hills Katameya', developer: 'Palm Hills Developments', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'palm-hills-october', name: 'Palm Hills October', developer: 'Palm Hills Developments', governorate: 'Giza', areaId: 'giza-6-october', type: 'residential' },
  { id: 'palm-hills-badya', name: 'Badya', developer: 'Palm Hills Developments', governorate: 'Giza', areaId: 'giza-6-october', type: 'residential' },
  { id: 'palm-hills-palm-valley', name: 'Palm Valley', developer: 'Palm Hills Developments', governorate: 'Giza', areaId: 'giza-sheikh-zayed', type: 'residential' },

  // ── Hassan Allam Developments ────────────────────────────────────────────
  { id: 'hassan-allam-swan-lake', name: 'Swan Lake Residence', developer: 'Hassan Allam Developments', governorate: 'Giza', areaId: 'giza-sheikh-zayed', type: 'residential', aliases: ['Swan Lake'] },
  { id: 'hassan-allam-swan-lake-north-coast', name: 'Swan Lake North Coast', developer: 'Hassan Allam Developments', governorate: 'North Coast', areaId: 'nc-el-alamein', type: 'coastal', aliases: ['Swan Lake North Coast', 'Swan Lake Northcoast'] },
  { id: 'hassan-allam-haptown', name: 'Haptown', developer: 'Hassan Allam Developments', governorate: 'Cairo', areaId: 'cairo-mostakbal-city', type: 'residential' },

  // ── Mountain View ─────────────────────────────────────────────────────────
  { id: 'mountain-view-icity', name: 'Mountain View iCity', developer: 'Mountain View', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'mountain-view-october-park', name: 'Mountain View October Park', developer: 'Mountain View', governorate: 'Giza', areaId: 'giza-6-october', type: 'residential' },
  { id: 'mountain-view-ras-el-hekma', name: 'Mountain View Ras El Hekma', developer: 'Mountain View', governorate: 'North Coast', areaId: 'nc-el-alamein', type: 'coastal' },

  // ── Hyde Park Developments ───────────────────────────────────────────────
  { id: 'hyde-park-new-cairo', name: 'Hyde Park New Cairo', developer: 'Hyde Park Developments', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },

  // ── SODIC ────────────────────────────────────────────────────────────────
  { id: 'sodic-east', name: 'SODIC East', developer: 'SODIC', governorate: 'Cairo', areaId: 'cairo-shorouk', type: 'residential' },
  { id: 'sodic-villette', name: 'Villette', developer: 'SODIC', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'sodic-beverly-hills', name: 'Beverly Hills', developer: 'SODIC', governorate: 'Giza', areaId: 'giza-zayed-2', type: 'villa' },
  { id: 'sodic-caesar', name: 'Caesar', developer: 'SODIC', governorate: 'North Coast', areaId: 'nc-el-alamein', type: 'coastal' },

  // ── Talaat Moustafa Group ────────────────────────────────────────────────
  { id: 'tmg-madinaty', name: 'Madinaty', developer: 'Talaat Moustafa Group', governorate: 'Cairo', areaId: 'cairo-madinaty', type: 'residential' },
  { id: 'tmg-al-rehab', name: 'Al Rehab City', developer: 'Talaat Moustafa Group', governorate: 'Cairo', areaId: 'cairo-rehab', type: 'residential' },
  { id: 'tmg-celia', name: 'Celia', developer: 'Talaat Moustafa Group', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },

  // ── Emaar Misr ───────────────────────────────────────────────────────────
  { id: 'emaar-uptown-cairo', name: 'Uptown Cairo', developer: 'Emaar Misr', governorate: 'Cairo', areaId: 'cairo-mokattam', type: 'residential' },
  { id: 'emaar-mivida', name: 'Mivida', developer: 'Emaar Misr', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'emaar-marassi', name: 'Marassi', developer: 'Emaar Misr', governorate: 'North Coast', areaId: 'nc-marassi', type: 'coastal' },

  // ── Ora Developers ───────────────────────────────────────────────────────
  { id: 'ora-zed-east', name: 'Zed East', developer: 'Ora Developers', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'ora-zed-towers', name: 'Zed Towers', developer: 'Ora Developers', governorate: 'Giza', areaId: 'giza-sheikh-zayed', type: 'residential' },

  // ── Tatweer Misr ─────────────────────────────────────────────────────────
  { id: 'tatweer-misr-fouka-bay', name: 'Fouka Bay', developer: 'Tatweer Misr', governorate: 'North Coast', areaId: 'nc-el-alamein', type: 'coastal' },
  { id: 'tatweer-misr-il-bosco', name: 'IL Bosco', developer: 'Tatweer Misr', governorate: 'Cairo', areaId: 'cairo-new-capital', type: 'residential' },
  { id: 'tatweer-misr-bloomfields', name: 'Bloomfields', developer: 'Tatweer Misr', governorate: 'Cairo', areaId: 'cairo-mostakbal-city', type: 'residential' },

  // ── Marakez ──────────────────────────────────────────────────────────────
  { id: 'marakez-district-5', name: 'District 5', developer: 'Marakez', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'marakez-mazarine', name: 'Mazarine', developer: 'Marakez', governorate: 'North Coast', areaId: 'nc-el-alamein', type: 'coastal' },

  // ── Al Ahly Sabbour ──────────────────────────────────────────────────────
  { id: 'sabbour-the-estates', name: 'The Estates', developer: 'Al Ahly Sabbour', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'sabbour-village-gate', name: 'Village Gate', developer: 'Al Ahly Sabbour', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },

  // ── Orascom Development Egypt ────────────────────────────────────────────
  { id: 'orascom-el-gouna', name: 'El Gouna', developer: 'Orascom Development Egypt', governorate: 'Red Sea', areaId: 'rs-el-gouna', type: 'coastal' },
  { id: 'orascom-o-west', name: 'O West', developer: 'Orascom Development Egypt', governorate: 'Giza', areaId: 'giza-6-october', type: 'residential' },
  { id: 'orascom-makadi-heights', name: 'Makadi Heights', developer: 'Orascom Development Egypt', governorate: 'Red Sea', areaId: 'rs-makadi', type: 'coastal' },

  // ── Misr Italia Properties ───────────────────────────────────────────────
  { id: 'misr-italia-il-monte-galala', name: 'IL Monte Galala', developer: 'Misr Italia Properties', governorate: 'Red Sea', areaId: 'rs-ain-sokhna', type: 'coastal' },
  { id: 'misr-italia-la-vista-sokhna', name: 'La Vista Ain Sokhna', developer: 'Misr Italia Properties', governorate: 'Red Sea', areaId: 'rs-ain-sokhna', type: 'coastal', aliases: ['La Vista'] },

  // ── Madinet Masr ─────────────────────────────────────────────────────────
  { id: 'madinet-masr-taj-city', name: 'Taj City', developer: 'Madinet Masr', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'madinet-masr-sarai', name: 'Sarai', developer: 'Madinet Masr', governorate: 'Cairo', areaId: 'cairo-mostakbal-city', type: 'residential' },

  // ── Amer Group ───────────────────────────────────────────────────────────
  { id: 'amer-group-porto-cairo', name: 'Porto Cairo', developer: 'Amer Group', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'amer-group-porto-marina', name: 'Porto Marina', developer: 'Amer Group', governorate: 'North Coast', areaId: 'nc-marina', type: 'coastal' },

  // ── Others (one confident flagship each) ─────────────────────────────────
  { id: 'al-marasem-fifth-square', name: 'Fifth Square', developer: 'Al Marasem', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'wadi-degla-taj-sultan', name: 'Taj Sultan', developer: 'Wadi Degla Developments', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'city-edge-central', name: 'Central', developer: 'City Edge Developments', governorate: 'Cairo', areaId: 'cairo-new-capital', type: 'residential' },
  { id: 'inertia-the-brooks', name: 'The Brooks', developer: 'Inertia Egypt', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
  { id: 'cred-address-east', name: 'Address East', developer: 'CRED', governorate: 'Cairo', areaId: 'cairo-new-cairo', type: 'residential' },
];
