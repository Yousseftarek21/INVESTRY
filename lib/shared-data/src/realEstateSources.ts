import type { REAreaPrice } from "./egyptRealEstatePrices";
import type { RECompound } from "./egyptRealEstateCompounds";

// What kind of unit a price per m² describes. An area's price is only
// comparable to the same kind of unit — a villa or a plot of land valued
// with an apartment price per m² is badly wrong either way.
export type PriceBasis = "apartment" | "chalet" | "villa";

export interface AqarmapSource {
  unit: PriceBasis;
  /** Location paths under https://aqarmap.com.eg/en/for-sale/<unit>/ —
   *  several paths are pooled into one price. */
  paths: string[];
}

// Every path below was verified on 2026-11-01 two ways: it appears in
// Aqarmap's own sitemap (sitemap.search-results-locations.xml) or loads
// without redirecting (Aqarmap silently serves the parent area for an
// unknown slug), and the page's own heading names the right place. Areas
// with no Aqarmap location (Obour, Dahab, Kharga, New Alexandria) are left
// out — Property Finder is their only source.
export const AQARMAP_AREA_SOURCES: Record<string, AqarmapSource> = {
  "cairo-zamalek": { unit: "apartment", paths: ["/cairo/al-zamalek/"] },
  "cairo-garden-city": { unit: "apartment", paths: ["/cairo/garden-city/"] },
  // Aqarmap's "New Cairo - 5th Settlement" page is really all of New Cairo
  // (it includes Madinaty, Rehab and the other settlements), so 5th
  // Settlement is built from its own core districts instead. These are
  // apartments outside compounds; compound units are priced per compound.
  "cairo-new-cairo": {
    unit: "apartment",
    paths: [
      "/cairo/new-cairo/90th-street/",
      "/cairo/new-cairo/north-investors/",
      "/cairo/new-cairo/south-investors/",
      "/cairo/new-cairo/golden-square/",
      "/cairo/new-cairo/el-narges/",
      "/cairo/new-cairo/el-lotus/",
      "/cairo/new-cairo/el-yassamin/",
    ],
  },
  "cairo-new-cairo-1st": { unit: "apartment", paths: ["/cairo/new-cairo/first-settlement/"] },
  "cairo-new-cairo-3rd": { unit: "apartment", paths: ["/cairo/new-cairo/third-settlement/"] },
  "cairo-mostakbal-city": { unit: "apartment", paths: ["/cairo/new-cairo/lmstqbl-syty/"] },
  "cairo-madinaty": { unit: "apartment", paths: ["/cairo/new-cairo/madinaty/"] },
  "cairo-rehab": { unit: "apartment", paths: ["/cairo/new-cairo/lrhb-city/"] },
  "cairo-heliopolis": { unit: "apartment", paths: ["/cairo/heliopolis/"] },
  "cairo-maadi": { unit: "apartment", paths: ["/cairo/el-maadi/"] },
  "cairo-nasr-city": { unit: "apartment", paths: ["/cairo/nasr-city/"] },
  "cairo-new-capital": { unit: "apartment", paths: ["/cairo/new-administrative-capital/"] },
  "cairo-shorouk": { unit: "apartment", paths: ["/cairo/el-shorouk/"] },
  "cairo-badr": { unit: "apartment", paths: ["/cairo/badr-city/"] },
  "cairo-mokattam": { unit: "apartment", paths: ["/cairo/mokattam/"] },
  "giza-sheikh-zayed": { unit: "apartment", paths: ["/cairo/el-sheikh-zayed-city/"] },
  "giza-6-october": { unit: "apartment", paths: ["/cairo/6th-of-october/"] },
  "giza-mohandessin": { unit: "apartment", paths: ["/cairo/el-mohandesen/"] },
  "giza-dokki": { unit: "apartment", paths: ["/cairo/dokki/"] },
  "giza-haram": { unit: "apartment", paths: ["/cairo/el-haram/"] },
  "giza-faisal": { unit: "apartment", paths: ["/cairo/faisal/"] },
  "giza-hadayek-ahram": { unit: "apartment", paths: ["/cairo/hadayek-el-ahram/"] },
  "giza-zayed-2": { unit: "villa", paths: ["/cairo/el-sheikh-zayed-city/compounds/beverly-hills/"] },
  "alex-san-stefano": { unit: "apartment", paths: ["/alexandria/san-stefano/"] },
  "alex-stanley": { unit: "apartment", paths: ["/alexandria/stanley/"] },
  "alex-smouha": { unit: "apartment", paths: ["/alexandria/smouha/"] },
  "alex-miami": { unit: "apartment", paths: ["/alexandria/miami/"] },
  "alex-mandara": { unit: "apartment", paths: ["/alexandria/el-mandara/"] },
  "alex-sporting": { unit: "apartment", paths: ["/alexandria/sporting/"] },
  "alex-agami": { unit: "apartment", paths: ["/alexandria/al-agamy/"] },
  "nc-marassi": { unit: "chalet", paths: ["/north-coast/resorts/mrsy/"] },
  "nc-hacienda-bay": { unit: "chalet", paths: ["/north-coast/resorts/hacienda-bay/"] },
  "nc-marina": { unit: "chalet", paths: ["/north-coast/resorts/marina/"] },
  "nc-sidi-heneish": { unit: "chalet", paths: ["/north-coast/sidi-henish/"] },
  "nc-el-alamein": { unit: "apartment", paths: ["/north-coast/new-alamein/"] },
  "rs-el-gouna": { unit: "apartment", paths: ["/red-sea/el-gouna/"] },
  "rs-hurghada": { unit: "apartment", paths: ["/red-sea/hurghada-city/"] },
  "rs-ain-sokhna": { unit: "chalet", paths: ["/ain-elsokhna/resorts/"] },
  "rs-makadi": { unit: "apartment", paths: ["/red-sea/hurghada-city/makadi-bay/"] },
  "sinai-sharm": { unit: "apartment", paths: ["/sharm-el-sheikh/"] },
  "sharqia-10-ramadan": { unit: "apartment", paths: ["/sharqia/10th-of-ramadan/"] },
  "dakahlia-mansoura": { unit: "apartment", paths: ["/dakahlia/mansoura/"] },
  "dakahlia-new-mansoura": { unit: "apartment", paths: ["/dakahlia/new-mansoura-city/"] },
  "ismailia-city": { unit: "apartment", paths: ["/ismailia/ismailia-city/"] },
  "suez-city": { unit: "apartment", paths: ["/suez/suez-city/"] },
  "luxor-city": { unit: "apartment", paths: ["/luxor/"] },
  "aswan-city": { unit: "apartment", paths: ["/aswan/aswan-city/"] },
  "port-said-city": { unit: "apartment", paths: ["/port-said/mdyn-bwr-s-yd/"] },
  "damietta-city": { unit: "apartment", paths: ["/damietta/mdyn-dmyt/"] },
  "beheira-damanhur": { unit: "apartment", paths: ["/beheira/damanhour/"] },
  "kafr-el-sheikh-city": { unit: "apartment", paths: ["/kafr-el-sheikh/kafr-el-sheikh-city/"] },
  "gharbia-tanta": { unit: "apartment", paths: ["/gharbia/tanta/"] },
  "menoufia-shibin": { unit: "apartment", paths: ["/monufia/shibin-el-kom/"] },
  "menoufia-sadat": { unit: "apartment", paths: ["/monufia/sadat-city/"] },
  "fayoum-city": { unit: "apartment", paths: ["/el-fayoum/fayoum/"] },
  "beni-suef-city": { unit: "apartment", paths: ["/beni-suef/mdyn-bny-swyf/"] },
  "minya-city": { unit: "apartment", paths: ["/el-minia/mdyn-lmny/"] },
  "assiut-city": { unit: "apartment", paths: ["/asyut/asyut-city/"] },
  "sohag-city": { unit: "apartment", paths: ["/sohag/sohag-city/"] },
  "qena-city": { unit: "apartment", paths: ["/qina/"] },
  "north-sinai-arish": { unit: "apartment", paths: ["/north-sinai/arish/"] },
};

// Same verification as the areas. Compounds with no Aqarmap page of their
// own, or more than one plausible match (e.g. several "La Vista" phases),
// are left out rather than guessed — Property Finder is their only source.
export const AQARMAP_COMPOUND_SOURCES: Record<string, AqarmapSource> = {
  "palm-hills-katameya": { unit: "villa", paths: ["/cairo/new-cairo/compounds/palm-hills-kattameya/"] },
  "palm-hills-badya": { unit: "apartment", paths: ["/cairo/6th-of-october/hadaeq-october/compounds/badya-compound-palm-hills/"] },
  "hassan-allam-swan-lake": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/swan-lake/"] },
  "hassan-allam-haptown": { unit: "apartment", paths: ["/cairo/new-cairo/lmstqbl-syty/compounds/hap-town/"] },
  "mountain-view-icity": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/mwntn-fyw-y-syty/"] },
  "hyde-park-new-cairo": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/hyde-park/"] },
  "sodic-east": { unit: "apartment", paths: ["/cairo/new-heliopolis/compounds/sodic-east/"] },
  "sodic-villette": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/villette/"] },
  "sodic-beverly-hills": { unit: "villa", paths: ["/cairo/el-sheikh-zayed-city/compounds/beverly-hills/"] },
  "tmg-madinaty": { unit: "apartment", paths: ["/cairo/new-cairo/madinaty/"] },
  "tmg-al-rehab": { unit: "apartment", paths: ["/cairo/new-cairo/lrhb-city/"] },
  "tmg-celia": { unit: "apartment", paths: ["/cairo/new-administrative-capital/r7/celia/"] },
  "emaar-mivida": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/mivida/"] },
  "emaar-marassi": { unit: "chalet", paths: ["/north-coast/resorts/mrsy/"] },
  "tatweer-misr-fouka-bay": { unit: "chalet", paths: ["/north-coast/resorts/fouka-bay/"] },
  "tatweer-misr-il-bosco": { unit: "apartment", paths: ["/cairo/new-administrative-capital/mntq-lmstthmryn/il-bosco/"] },
  "tatweer-misr-bloomfields": { unit: "apartment", paths: ["/cairo/new-cairo/lmstqbl-syty/compounds/bloomfields/"] },
  "marakez-district-5": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/district-5/"] },
  "orascom-el-gouna": { unit: "apartment", paths: ["/red-sea/el-gouna/"] },
  "orascom-o-west": { unit: "apartment", paths: ["/cairo/6th-of-october/hadaeq-october/compounds/o-west/"] },
  "misr-italia-il-monte-galala": { unit: "chalet", paths: ["/ain-elsokhna/resorts/il-monte-galala/"] },
  "madinet-masr-taj-city": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/tag-city/"] },
  "madinet-masr-sarai": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/sarai/"] },
  "al-marasem-fifth-square": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/fifth-square/"] },
  "wadi-degla-taj-sultan": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/tag-city/taj-sultan/"] },
  "cred-address-east": { unit: "apartment", paths: ["/cairo/new-cairo/compounds/the-address-east/"] },
};

const DEFAULT_BASIS: Record<string, PriceBasis> = { coastal: "chalet", villa: "villa" };

/** The kind of unit an area's price per m² describes. */
export function priceBasisForArea(area: Pick<REAreaPrice, "id" | "type">): PriceBasis {
  return AQARMAP_AREA_SOURCES[area.id]?.unit ?? DEFAULT_BASIS[area.type] ?? "apartment";
}

/** The kind of unit a compound's price per m² describes. */
export function priceBasisForCompound(compound: Pick<RECompound, "id" | "type">): PriceBasis {
  return AQARMAP_COMPOUND_SOURCES[compound.id]?.unit ?? DEFAULT_BASIS[compound.type] ?? "apartment";
}
