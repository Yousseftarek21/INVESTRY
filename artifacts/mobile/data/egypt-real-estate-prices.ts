// Curated Egypt real estate price estimates per m² (EGP).
// Sources: Aqarmap, Property Finder Egypt, OLX Egypt — averaged Q2 2026.
// Update via OTA whenever market shifts significantly.

export type RETrend = 'up' | 'stable' | 'down';
export type REPropertyType = 'residential' | 'villa' | 'commercial' | 'land' | 'coastal';

export interface REAreaPrice {
  id: string;
  governorate: string;
  area: string;             // city / district name shown to user
  minPricePerM2: number;   // EGP
  maxPricePerM2: number;   // EGP
  avgPricePerM2: number;   // EGP
  trend: RETrend;
  changePercent: number;   // YoY % change (positive = up)
  type: REPropertyType;
  note?: string;           // optional context (e.g. "Seasonal / chalet")
}

export const LAST_UPDATED = '2026-06-01';

export const RE_PRICES: REAreaPrice[] = [
  // ── Cairo ────────────────────────────────────────────────────────────────────
  {
    id: 'cairo-zamalek',
    governorate: 'Cairo',
    area: 'Zamalek',
    minPricePerM2: 38_000, maxPricePerM2: 75_000, avgPricePerM2: 55_000,
    trend: 'up', changePercent: 18, type: 'residential',
  },
  {
    id: 'cairo-garden-city',
    governorate: 'Cairo',
    area: 'Garden City',
    minPricePerM2: 32_000, maxPricePerM2: 65_000, avgPricePerM2: 47_000,
    trend: 'up', changePercent: 16, type: 'residential',
  },
  {
    id: 'cairo-new-cairo',
    governorate: 'Cairo',
    area: 'New Cairo — 5th Settlement',
    minPricePerM2: 28_000, maxPricePerM2: 65_000, avgPricePerM2: 42_000,
    trend: 'up', changePercent: 22, type: 'residential',
  },
  {
    id: 'cairo-new-cairo-1st',
    governorate: 'Cairo',
    area: 'New Cairo — 1st Settlement',
    minPricePerM2: 20_000, maxPricePerM2: 42_000, avgPricePerM2: 30_000,
    trend: 'up', changePercent: 16, type: 'residential',
  },
  {
    id: 'cairo-new-cairo-3rd',
    governorate: 'Cairo',
    area: 'New Cairo — 3rd Settlement',
    minPricePerM2: 24_000, maxPricePerM2: 50_000, avgPricePerM2: 35_000,
    trend: 'up', changePercent: 19, type: 'residential',
  },
  {
    id: 'cairo-mostakbal-city',
    governorate: 'Cairo',
    area: 'Mostakbal City',
    minPricePerM2: 14_000, maxPricePerM2: 28_000, avgPricePerM2: 20_000,
    trend: 'up', changePercent: 23, type: 'residential',
    note: 'Newer, further-out extension of New Cairo — priced well below the older settlements',
  },
  {
    id: 'cairo-madinaty',
    governorate: 'Cairo',
    area: 'Madinaty',
    minPricePerM2: 22_000, maxPricePerM2: 45_000, avgPricePerM2: 32_000,
    trend: 'up', changePercent: 20, type: 'residential',
  },
  {
    id: 'cairo-rehab',
    governorate: 'Cairo',
    area: 'Al Rehab City',
    minPricePerM2: 18_000, maxPricePerM2: 38_000, avgPricePerM2: 27_000,
    trend: 'up', changePercent: 19, type: 'residential',
  },
  {
    id: 'cairo-heliopolis',
    governorate: 'Cairo',
    area: 'Heliopolis',
    minPricePerM2: 22_000, maxPricePerM2: 48_000, avgPricePerM2: 34_000,
    trend: 'up', changePercent: 17, type: 'residential',
  },
  {
    id: 'cairo-maadi',
    governorate: 'Cairo',
    area: 'Maadi',
    minPricePerM2: 20_000, maxPricePerM2: 45_000, avgPricePerM2: 32_000,
    trend: 'up', changePercent: 15, type: 'residential',
  },
  {
    id: 'cairo-nasr-city',
    governorate: 'Cairo',
    area: 'Nasr City',
    minPricePerM2: 14_000, maxPricePerM2: 28_000, avgPricePerM2: 20_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },
  {
    id: 'cairo-new-capital',
    governorate: 'Cairo',
    area: 'New Administrative Capital',
    minPricePerM2: 18_000, maxPricePerM2: 45_000, avgPricePerM2: 28_000,
    trend: 'up', changePercent: 25, type: 'residential',
    note: 'Prices vary widely by district & developer',
  },
  {
    id: 'cairo-shorouk',
    governorate: 'Cairo',
    area: 'Shorouk City',
    minPricePerM2: 14_000, maxPricePerM2: 28_000, avgPricePerM2: 20_000,
    trend: 'up', changePercent: 14, type: 'residential',
  },
  {
    id: 'cairo-badr',
    governorate: 'Cairo',
    area: 'Badr City',
    minPricePerM2: 8_000, maxPricePerM2: 16_000, avgPricePerM2: 11_000,
    trend: 'stable', changePercent: 10, type: 'residential',
  },
  {
    id: 'cairo-mokattam',
    governorate: 'Cairo',
    area: 'Mokattam',
    minPricePerM2: 12_000, maxPricePerM2: 22_000, avgPricePerM2: 16_000,
    trend: 'stable', changePercent: 9, type: 'residential',
  },

  // ── Giza ────────────────────────────────────────────────────────────────────
  {
    id: 'giza-sheikh-zayed',
    governorate: 'Giza',
    area: 'Sheikh Zayed',
    minPricePerM2: 18_000, maxPricePerM2: 45_000, avgPricePerM2: 30_000,
    trend: 'up', changePercent: 20, type: 'residential',
  },
  {
    id: 'giza-6-october',
    governorate: 'Giza',
    area: '6th of October',
    minPricePerM2: 10_000, maxPricePerM2: 24_000, avgPricePerM2: 16_000,
    trend: 'up', changePercent: 15, type: 'residential',
  },
  {
    id: 'giza-mohandessin',
    governorate: 'Giza',
    area: 'Mohandessin',
    minPricePerM2: 20_000, maxPricePerM2: 42_000, avgPricePerM2: 30_000,
    trend: 'up', changePercent: 16, type: 'residential',
  },
  {
    id: 'giza-dokki',
    governorate: 'Giza',
    area: 'Dokki',
    minPricePerM2: 18_000, maxPricePerM2: 38_000, avgPricePerM2: 27_000,
    trend: 'up', changePercent: 14, type: 'residential',
  },
  {
    id: 'giza-haram',
    governorate: 'Giza',
    area: 'Haram',
    minPricePerM2: 9_000, maxPricePerM2: 18_000, avgPricePerM2: 13_000,
    trend: 'stable', changePercent: 9, type: 'residential',
  },
  {
    id: 'giza-faisal',
    governorate: 'Giza',
    area: 'Faisal',
    minPricePerM2: 7_000, maxPricePerM2: 14_000, avgPricePerM2: 10_000,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'giza-hadayek-ahram',
    governorate: 'Giza',
    area: 'Hadayek El Ahram',
    minPricePerM2: 10_000, maxPricePerM2: 20_000, avgPricePerM2: 14_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },
  {
    id: 'giza-zayed-2',
    governorate: 'Giza',
    area: 'Zayed 2 / Beverly Hills',
    minPricePerM2: 22_000, maxPricePerM2: 50_000, avgPricePerM2: 34_000,
    trend: 'up', changePercent: 21, type: 'villa',
  },

  // ── Alexandria ───────────────────────────────────────────────────────────────
  {
    id: 'alex-san-stefano',
    governorate: 'Alexandria',
    area: 'San Stefano',
    minPricePerM2: 18_000, maxPricePerM2: 40_000, avgPricePerM2: 28_000,
    trend: 'up', changePercent: 14, type: 'residential',
  },
  {
    id: 'alex-stanley',
    governorate: 'Alexandria',
    area: 'Stanley',
    minPricePerM2: 16_000, maxPricePerM2: 35_000, avgPricePerM2: 25_000,
    trend: 'up', changePercent: 13, type: 'residential',
  },
  {
    id: 'alex-smouha',
    governorate: 'Alexandria',
    area: 'Smouha',
    minPricePerM2: 14_000, maxPricePerM2: 30_000, avgPricePerM2: 21_000,
    trend: 'up', changePercent: 12, type: 'residential',
  },
  {
    id: 'alex-miami',
    governorate: 'Alexandria',
    area: 'Miami',
    minPricePerM2: 12_000, maxPricePerM2: 24_000, avgPricePerM2: 17_000,
    trend: 'stable', changePercent: 9, type: 'residential',
  },
  {
    id: 'alex-mandara',
    governorate: 'Alexandria',
    area: 'Mandara',
    minPricePerM2: 10_000, maxPricePerM2: 20_000, avgPricePerM2: 14_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },
  {
    id: 'alex-sporting',
    governorate: 'Alexandria',
    area: 'Sporting',
    minPricePerM2: 14_000, maxPricePerM2: 28_000, avgPricePerM2: 20_000,
    trend: 'stable', changePercent: 10, type: 'residential',
  },
  {
    id: 'alex-agami',
    governorate: 'Alexandria',
    area: 'Agami',
    minPricePerM2: 9_000, maxPricePerM2: 18_000, avgPricePerM2: 13_000,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'alex-new-alex',
    governorate: 'Alexandria',
    area: 'New Alexandria',
    minPricePerM2: 7_000, maxPricePerM2: 15_000, avgPricePerM2: 10_000,
    trend: 'up', changePercent: 12, type: 'residential',
  },

  // ── North Coast ──────────────────────────────────────────────────────────────
  {
    id: 'nc-marassi',
    governorate: 'North Coast',
    area: 'Marassi',
    minPricePerM2: 45_000, maxPricePerM2: 120_000, avgPricePerM2: 75_000,
    trend: 'up', changePercent: 30, type: 'coastal',
    note: 'Seasonal / chalet pricing',
  },
  {
    id: 'nc-hacienda-bay',
    governorate: 'North Coast',
    area: 'Hacienda Bay',
    minPricePerM2: 40_000, maxPricePerM2: 100_000, avgPricePerM2: 65_000,
    trend: 'up', changePercent: 28, type: 'coastal',
    note: 'Seasonal / chalet pricing',
  },
  {
    id: 'nc-marina',
    governorate: 'North Coast',
    area: 'Marina El Alamein',
    minPricePerM2: 20_000, maxPricePerM2: 55_000, avgPricePerM2: 35_000,
    trend: 'up', changePercent: 24, type: 'coastal',
    note: 'Seasonal / chalet pricing',
  },
  {
    id: 'nc-sidi-heneish',
    governorate: 'North Coast',
    area: 'Sidi Heneish / Sahel General',
    minPricePerM2: 15_000, maxPricePerM2: 45_000, avgPricePerM2: 28_000,
    trend: 'up', changePercent: 20, type: 'coastal',
    note: 'Seasonal / chalet pricing',
  },
  {
    id: 'nc-el-alamein',
    governorate: 'North Coast',
    area: 'New El Alamein City',
    minPricePerM2: 12_000, maxPricePerM2: 32_000, avgPricePerM2: 20_000,
    trend: 'up', changePercent: 35, type: 'residential',
  },

  // ── Red Sea ──────────────────────────────────────────────────────────────────
  {
    id: 'rs-el-gouna',
    governorate: 'Red Sea',
    area: 'El Gouna',
    minPricePerM2: 18_000, maxPricePerM2: 50_000, avgPricePerM2: 32_000,
    trend: 'up', changePercent: 22, type: 'coastal',
  },
  {
    id: 'rs-hurghada',
    governorate: 'Red Sea',
    area: 'Hurghada',
    minPricePerM2: 7_000, maxPricePerM2: 22_000, avgPricePerM2: 13_000,
    trend: 'up', changePercent: 18, type: 'residential',
  },
  {
    id: 'rs-ain-sokhna',
    governorate: 'Red Sea',
    area: 'Ain Sokhna',
    minPricePerM2: 18_000, maxPricePerM2: 55_000, avgPricePerM2: 34_000,
    trend: 'up', changePercent: 26, type: 'coastal',
    note: 'Seasonal / chalet pricing',
  },
  {
    id: 'rs-makadi',
    governorate: 'Red Sea',
    area: 'Makadi Bay',
    minPricePerM2: 12_000, maxPricePerM2: 35_000, avgPricePerM2: 22_000,
    trend: 'up', changePercent: 20, type: 'coastal',
  },

  // ── South Sinai ───────────────────────────────────────────────────────────────
  {
    id: 'sinai-sharm',
    governorate: 'South Sinai',
    area: 'Sharm El Sheikh',
    minPricePerM2: 10_000, maxPricePerM2: 30_000, avgPricePerM2: 18_000,
    trend: 'up', changePercent: 15, type: 'residential',
  },
  {
    id: 'sinai-dahab',
    governorate: 'South Sinai',
    area: 'Dahab',
    minPricePerM2: 6_000, maxPricePerM2: 18_000, avgPricePerM2: 11_000,
    trend: 'stable', changePercent: 10, type: 'residential',
  },

  // ── Sharqia ──────────────────────────────────────────────────────────────────
  {
    id: 'sharqia-obour',
    governorate: 'Sharqia',
    area: 'Obour City',
    minPricePerM2: 7_000, maxPricePerM2: 15_000, avgPricePerM2: 10_000,
    trend: 'stable', changePercent: 9, type: 'residential',
  },
  {
    id: 'sharqia-10-ramadan',
    governorate: 'Sharqia',
    area: '10th of Ramadan',
    minPricePerM2: 5_000, maxPricePerM2: 12_000, avgPricePerM2: 8_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },

  // ── Dakahlia / Mansoura ───────────────────────────────────────────────────────
  {
    id: 'dakahlia-mansoura',
    governorate: 'Dakahlia',
    area: 'Mansoura',
    minPricePerM2: 6_000, maxPricePerM2: 16_000, avgPricePerM2: 10_000,
    trend: 'stable', changePercent: 10, type: 'residential',
  },
  {
    id: 'dakahlia-new-mansoura',
    governorate: 'Dakahlia',
    area: 'New Mansoura City',
    minPricePerM2: 8_000, maxPricePerM2: 20_000, avgPricePerM2: 13_000,
    trend: 'up', changePercent: 18, type: 'residential',
  },

  // ── Ismailia ──────────────────────────────────────────────────────────────────
  {
    id: 'ismailia-city',
    governorate: 'Ismailia',
    area: 'Ismailia City',
    minPricePerM2: 5_000, maxPricePerM2: 13_000, avgPricePerM2: 8_500,
    trend: 'stable', changePercent: 9, type: 'residential',
  },

  // ── Suez ──────────────────────────────────────────────────────────────────────
  {
    id: 'suez-city',
    governorate: 'Suez',
    area: 'Suez City',
    minPricePerM2: 4_500, maxPricePerM2: 11_000, avgPricePerM2: 7_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },

  // ── Luxor / Aswan ──────────────────────────────────────────────────────────────
  {
    id: 'luxor-city',
    governorate: 'Luxor',
    area: 'Luxor City',
    minPricePerM2: 3_500, maxPricePerM2: 9_000, avgPricePerM2: 5_500,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'aswan-city',
    governorate: 'Aswan',
    area: 'Aswan City',
    minPricePerM2: 3_000, maxPricePerM2: 8_000, avgPricePerM2: 5_000,
    trend: 'stable', changePercent: 6, type: 'residential',
  },

  // ── Other governorates ──────────────────────────────────────────────────────
  {
    id: 'port-said-city',
    governorate: 'Port Said',
    area: 'Port Said City',
    minPricePerM2: 8_000, maxPricePerM2: 20_000, avgPricePerM2: 13_000,
    trend: 'stable', changePercent: 9, type: 'residential',
  },
  {
    id: 'damietta-city',
    governorate: 'Damietta',
    area: 'Damietta City',
    minPricePerM2: 6_000, maxPricePerM2: 15_000, avgPricePerM2: 10_000,
    trend: 'stable', changePercent: 8, type: 'residential',
  },
  {
    id: 'beheira-damanhur',
    governorate: 'Beheira',
    area: 'Damanhur',
    minPricePerM2: 4_000, maxPricePerM2: 10_000, avgPricePerM2: 6_500,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'kafr-el-sheikh-city',
    governorate: 'Kafr El Sheikh',
    area: 'Kafr El Sheikh City',
    minPricePerM2: 4_000, maxPricePerM2: 10_000, avgPricePerM2: 6_500,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'gharbia-tanta',
    governorate: 'Gharbia',
    area: 'Tanta',
    minPricePerM2: 5_500, maxPricePerM2: 13_000, avgPricePerM2: 8_500,
    trend: 'stable', changePercent: 8, type: 'residential',
  },
  {
    id: 'menoufia-shibin',
    governorate: 'Menoufia',
    area: 'Shibin El Kom',
    minPricePerM2: 4_500, maxPricePerM2: 11_000, avgPricePerM2: 7_000,
    trend: 'stable', changePercent: 7, type: 'residential',
  },
  {
    id: 'menoufia-sadat',
    governorate: 'Menoufia',
    area: 'Sadat City',
    minPricePerM2: 6_000, maxPricePerM2: 14_000, avgPricePerM2: 9_000,
    trend: 'up', changePercent: 12, type: 'residential',
  },
  {
    id: 'fayoum-city',
    governorate: 'Fayoum',
    area: 'Fayoum City',
    minPricePerM2: 3_500, maxPricePerM2: 9_000, avgPricePerM2: 5_500,
    trend: 'stable', changePercent: 6, type: 'residential',
  },
  {
    id: 'beni-suef-city',
    governorate: 'Beni Suef',
    area: 'Beni Suef City',
    minPricePerM2: 3_500, maxPricePerM2: 9_000, avgPricePerM2: 5_500,
    trend: 'stable', changePercent: 6, type: 'residential',
  },
  {
    id: 'minya-city',
    governorate: 'Minya',
    area: 'Minya City',
    minPricePerM2: 3_000, maxPricePerM2: 8_000, avgPricePerM2: 5_000,
    trend: 'stable', changePercent: 6, type: 'residential',
  },
  {
    id: 'assiut-city',
    governorate: 'Assiut',
    area: 'Assiut City',
    minPricePerM2: 3_000, maxPricePerM2: 8_000, avgPricePerM2: 5_000,
    trend: 'stable', changePercent: 6, type: 'residential',
  },
  {
    id: 'sohag-city',
    governorate: 'Sohag',
    area: 'Sohag City',
    minPricePerM2: 2_800, maxPricePerM2: 7_500, avgPricePerM2: 4_800,
    trend: 'stable', changePercent: 5, type: 'residential',
  },
  {
    id: 'qena-city',
    governorate: 'Qena',
    area: 'Qena City',
    minPricePerM2: 2_800, maxPricePerM2: 7_500, avgPricePerM2: 4_800,
    trend: 'stable', changePercent: 5, type: 'residential',
  },
  {
    id: 'new-valley-kharga',
    governorate: 'New Valley',
    area: 'Kharga',
    minPricePerM2: 2_500, maxPricePerM2: 6_500, avgPricePerM2: 4_200,
    trend: 'stable', changePercent: 5, type: 'residential',
  },
  {
    id: 'north-sinai-arish',
    governorate: 'North Sinai',
    area: 'Arish',
    minPricePerM2: 3_500, maxPricePerM2: 9_000, avgPricePerM2: 5_500,
    trend: 'stable', changePercent: 6, type: 'residential',
  },
];

export const RE_GOVERNORATES = ['All', ...Array.from(new Set(RE_PRICES.map(a => a.governorate)))];

export function searchREAreas(query: string): REAreaPrice[] {
  const q = query.toLowerCase().trim();
  if (!q) return RE_PRICES;
  return RE_PRICES.filter(
    a =>
      a.area.toLowerCase().includes(q) ||
      a.governorate.toLowerCase().includes(q),
  );
}
