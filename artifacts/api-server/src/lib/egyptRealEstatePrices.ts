// Curated Egypt real estate price estimates per m² (EGP), mirrored from
// artifacts/mobile/data/egypt-real-estate-prices.ts so the AI Assistant can
// discuss any area's market, not just what the user personally owns. Keep
// the two files in sync when prices are updated.
// Sources: Aqarmap, Property Finder Egypt, OLX Egypt — averaged Q2 2026.

export interface REAreaPrice {
  governorate: string;
  area: string;
  avgPricePerM2: number;
  trend: "up" | "stable" | "down";
  changePercent: number;
}

export const RE_PRICES: REAreaPrice[] = [
  { governorate: "Cairo", area: "Zamalek", avgPricePerM2: 55_000, trend: "up", changePercent: 18 },
  { governorate: "Cairo", area: "Garden City", avgPricePerM2: 47_000, trend: "up", changePercent: 16 },
  { governorate: "Cairo", area: "New Cairo — 5th Settlement", avgPricePerM2: 42_000, trend: "up", changePercent: 22 },
  { governorate: "Cairo", area: "New Cairo — 1st Settlement", avgPricePerM2: 30_000, trend: "up", changePercent: 16 },
  { governorate: "Cairo", area: "New Cairo — 3rd Settlement", avgPricePerM2: 35_000, trend: "up", changePercent: 19 },
  { governorate: "Cairo", area: "Mostakbal City", avgPricePerM2: 20_000, trend: "up", changePercent: 23 },
  { governorate: "Cairo", area: "Madinaty", avgPricePerM2: 32_000, trend: "up", changePercent: 20 },
  { governorate: "Cairo", area: "Al Rehab City", avgPricePerM2: 27_000, trend: "up", changePercent: 19 },
  { governorate: "Cairo", area: "Heliopolis", avgPricePerM2: 34_000, trend: "up", changePercent: 17 },
  { governorate: "Cairo", area: "Maadi", avgPricePerM2: 32_000, trend: "up", changePercent: 15 },
  { governorate: "Cairo", area: "Nasr City", avgPricePerM2: 20_000, trend: "stable", changePercent: 8 },
  { governorate: "Cairo", area: "New Administrative Capital", avgPricePerM2: 28_000, trend: "up", changePercent: 25 },
  { governorate: "Cairo", area: "Shorouk City", avgPricePerM2: 20_000, trend: "up", changePercent: 14 },
  { governorate: "Cairo", area: "Badr City", avgPricePerM2: 11_000, trend: "stable", changePercent: 10 },
  { governorate: "Cairo", area: "Mokattam", avgPricePerM2: 16_000, trend: "stable", changePercent: 9 },
  { governorate: "Giza", area: "Sheikh Zayed", avgPricePerM2: 30_000, trend: "up", changePercent: 20 },
  { governorate: "Giza", area: "6th of October", avgPricePerM2: 16_000, trend: "up", changePercent: 15 },
  { governorate: "Giza", area: "Mohandessin", avgPricePerM2: 30_000, trend: "up", changePercent: 16 },
  { governorate: "Giza", area: "Dokki", avgPricePerM2: 27_000, trend: "up", changePercent: 14 },
  { governorate: "Giza", area: "Haram", avgPricePerM2: 13_000, trend: "stable", changePercent: 9 },
  { governorate: "Giza", area: "Faisal", avgPricePerM2: 10_000, trend: "stable", changePercent: 7 },
  { governorate: "Giza", area: "Hadayek El Ahram", avgPricePerM2: 14_000, trend: "stable", changePercent: 8 },
  { governorate: "Giza", area: "Zayed 2 / Beverly Hills", avgPricePerM2: 34_000, trend: "up", changePercent: 21 },
  { governorate: "Alexandria", area: "San Stefano", avgPricePerM2: 28_000, trend: "up", changePercent: 14 },
  { governorate: "Alexandria", area: "Stanley", avgPricePerM2: 25_000, trend: "up", changePercent: 13 },
  { governorate: "Alexandria", area: "Smouha", avgPricePerM2: 21_000, trend: "up", changePercent: 12 },
  { governorate: "Alexandria", area: "Miami", avgPricePerM2: 17_000, trend: "stable", changePercent: 9 },
  { governorate: "Alexandria", area: "Mandara", avgPricePerM2: 14_000, trend: "stable", changePercent: 8 },
  { governorate: "Alexandria", area: "Sporting", avgPricePerM2: 20_000, trend: "stable", changePercent: 10 },
  { governorate: "Alexandria", area: "Agami", avgPricePerM2: 13_000, trend: "stable", changePercent: 7 },
  { governorate: "Alexandria", area: "New Alexandria", avgPricePerM2: 10_000, trend: "up", changePercent: 12 },
  { governorate: "North Coast", area: "Marassi", avgPricePerM2: 75_000, trend: "up", changePercent: 30 },
  { governorate: "North Coast", area: "Hacienda Bay", avgPricePerM2: 65_000, trend: "up", changePercent: 28 },
  { governorate: "North Coast", area: "Marina El Alamein", avgPricePerM2: 35_000, trend: "up", changePercent: 24 },
  { governorate: "North Coast", area: "Sidi Heneish / Sahel General", avgPricePerM2: 28_000, trend: "up", changePercent: 20 },
  { governorate: "North Coast", area: "New El Alamein City", avgPricePerM2: 20_000, trend: "up", changePercent: 35 },
  { governorate: "Red Sea", area: "El Gouna", avgPricePerM2: 32_000, trend: "up", changePercent: 22 },
  { governorate: "Red Sea", area: "Hurghada", avgPricePerM2: 13_000, trend: "up", changePercent: 18 },
  { governorate: "Red Sea", area: "Ain Sokhna", avgPricePerM2: 34_000, trend: "up", changePercent: 26 },
  { governorate: "Red Sea", area: "Makadi Bay", avgPricePerM2: 22_000, trend: "up", changePercent: 20 },
  { governorate: "South Sinai", area: "Sharm El Sheikh", avgPricePerM2: 18_000, trend: "up", changePercent: 15 },
  { governorate: "South Sinai", area: "Dahab", avgPricePerM2: 11_000, trend: "stable", changePercent: 10 },
  { governorate: "Sharqia", area: "Obour City", avgPricePerM2: 10_000, trend: "stable", changePercent: 9 },
  { governorate: "Sharqia", area: "10th of Ramadan", avgPricePerM2: 8_000, trend: "stable", changePercent: 8 },
  { governorate: "Dakahlia", area: "Mansoura", avgPricePerM2: 10_000, trend: "stable", changePercent: 10 },
  { governorate: "Dakahlia", area: "New Mansoura City", avgPricePerM2: 13_000, trend: "up", changePercent: 18 },
  { governorate: "Ismailia", area: "Ismailia City", avgPricePerM2: 8_500, trend: "stable", changePercent: 9 },
  { governorate: "Suez", area: "Suez City", avgPricePerM2: 7_000, trend: "stable", changePercent: 8 },
  { governorate: "Luxor", area: "Luxor City", avgPricePerM2: 5_500, trend: "stable", changePercent: 7 },
  { governorate: "Aswan", area: "Aswan City", avgPricePerM2: 5_000, trend: "stable", changePercent: 6 },
  { governorate: "Port Said", area: "Port Said City", avgPricePerM2: 13_000, trend: "stable", changePercent: 9 },
  { governorate: "Damietta", area: "Damietta City", avgPricePerM2: 10_000, trend: "stable", changePercent: 8 },
  { governorate: "Beheira", area: "Damanhur", avgPricePerM2: 6_500, trend: "stable", changePercent: 7 },
  { governorate: "Kafr El Sheikh", area: "Kafr El Sheikh City", avgPricePerM2: 6_500, trend: "stable", changePercent: 7 },
  { governorate: "Gharbia", area: "Tanta", avgPricePerM2: 8_500, trend: "stable", changePercent: 8 },
  { governorate: "Menoufia", area: "Shibin El Kom", avgPricePerM2: 7_000, trend: "stable", changePercent: 7 },
  { governorate: "Menoufia", area: "Sadat City", avgPricePerM2: 9_000, trend: "up", changePercent: 12 },
  { governorate: "Fayoum", area: "Fayoum City", avgPricePerM2: 5_500, trend: "stable", changePercent: 6 },
  { governorate: "Beni Suef", area: "Beni Suef City", avgPricePerM2: 5_500, trend: "stable", changePercent: 6 },
  { governorate: "Minya", area: "Minya City", avgPricePerM2: 5_000, trend: "stable", changePercent: 6 },
  { governorate: "Assiut", area: "Assiut City", avgPricePerM2: 5_000, trend: "stable", changePercent: 6 },
  { governorate: "Sohag", area: "Sohag City", avgPricePerM2: 4_800, trend: "stable", changePercent: 5 },
  { governorate: "Qena", area: "Qena City", avgPricePerM2: 4_800, trend: "stable", changePercent: 5 },
  { governorate: "New Valley", area: "Kharga", avgPricePerM2: 4_200, trend: "stable", changePercent: 5 },
  { governorate: "North Sinai", area: "Arish", avgPricePerM2: 5_500, trend: "stable", changePercent: 6 },
];
