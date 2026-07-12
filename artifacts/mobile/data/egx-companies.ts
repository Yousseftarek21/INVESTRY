// Egyptian Exchange (EGX) — verified company database
// Tickers cross-referenced with official EGX list; live prices via TradingView scanner

export const EGX_SECTORS = [
  'All',
  'Banking',
  'Financial Services',
  'Real Estate',
  'Telecommunications',
  'Industrial',
  'Chemicals & Fertilizers',
  'Energy',
  'Construction Materials',
  'Healthcare',
  'Food & Beverage',
  'Technology',
  'Textile',
  'Transportation',
] as const;

export type EGXSector = typeof EGX_SECTORS[number];

export interface EGXCompany {
  ticker: string;
  yahoo: string;
  nameEn: string;
  nameAr: string;
  sector: Exclude<EGXSector, 'All'>;
  industry: string;
  fallbackPrice: number;
}

export const EGX_COMPANIES: EGXCompany[] = [
  // ─── Banking ──────────────────────────────────────────────────────────────
  { ticker: 'COMI',  yahoo: 'COMI.CA',  nameEn: 'Commercial International Bank (CIB)', nameAr: 'البنك التجاري الدولي',              sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 134.50 },
  { ticker: 'CIEB',  yahoo: 'CIEB.CA',  nameEn: 'Credit Agricole Egypt',               nameAr: 'كريدي أجريكول مصر',               sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 24.00  },
  { ticker: 'ADIB',  yahoo: 'ADIB.CA',  nameEn: 'Abu Dhabi Islamic Bank Egypt',        nameAr: 'بنك أبو ظبي الإسلامي مصر',        sector: 'Banking',               industry: 'Islamic Banking',         fallbackPrice: 47.00  },
  { ticker: 'HDBK',  yahoo: 'HDBK.CA',  nameEn: 'Housing & Development Bank',          nameAr: 'بنك التعمير والإسكان',             sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 79.50  },
  { ticker: 'QNBE',  yahoo: 'QNBE.CA',  nameEn: 'QNB Alahli',                          nameAr: 'بنك قطر الأهلي',                  sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 69.00  },

  // ─── Financial Services ───────────────────────────────────────────────────
  { ticker: 'HRHO',  yahoo: 'HRHO.CA',  nameEn: 'EFG Holding',                         nameAr: 'هيرميس للأوراق المالية',           sector: 'Financial Services',    industry: 'Investment Banking',      fallbackPrice: 26.70  },
  { ticker: 'CICH',  yahoo: 'CICH.CA',  nameEn: 'CI Capital Holding',                  nameAr: 'سي آي كابيتال القابضة',           sector: 'Financial Services',    industry: 'Brokerage',               fallbackPrice: 11.60  },
  { ticker: 'EFIC',  yahoo: 'EFIC.CA',  nameEn: 'Egyptian Financial & Industrial',     nameAr: 'المصرية المالية والصناعية',       sector: 'Financial Services',    industry: 'Diversified Financials',  fallbackPrice: 180.00 },
  { ticker: 'GBCO',  yahoo: 'GBCO.CA',  nameEn: 'GB Capital Holding',                  nameAr: 'جي بي كابيتال القابضة',           sector: 'Financial Services',    industry: 'Consumer Finance',        fallbackPrice: 6.50   },
  { ticker: 'CCAP',  yahoo: 'CCAP.CA',  nameEn: 'Cairo Capital Market for Investment', nameAr: 'القاهرة لأسواق المال',            sector: 'Financial Services',    industry: 'Investment Banking',      fallbackPrice: 5.20   },
  { ticker: 'BINV',  yahoo: 'BINV.CA',  nameEn: 'Beltone Investments',                 nameAr: 'بلتون للاستثمارات المالية',       sector: 'Financial Services',    industry: 'Investment Banking',      fallbackPrice: 3.50   },
  { ticker: 'SVCE',  yahoo: 'SVCE.CA',  nameEn: 'Sarwa Capital Holding',               nameAr: 'صروة كابيتال القابضة',            sector: 'Financial Services',    industry: 'Diversified Financials',  fallbackPrice: 4.10   },
  { ticker: 'CNFN',  yahoo: 'CNFN.CA',  nameEn: 'Contact Financial Holding',           nameAr: 'كونتاكت للاستثمار المالي',        sector: 'Financial Services',    industry: 'Consumer Finance',        fallbackPrice: 12.50  },
  { ticker: 'MENA',  yahoo: 'MENA.CA',  nameEn: 'MENA Financial Investments',          nameAr: 'الشرق الأوسط للاستثمار المالي',  sector: 'Financial Services',    industry: 'Diversified Financials',  fallbackPrice: 4.30   },
  { ticker: 'RACC',  yahoo: 'RACC.CA',  nameEn: 'Raya Contact Center',                 nameAr: 'رايا لخدمات مراكز الاتصال',       sector: 'Financial Services',    industry: 'Business Services',       fallbackPrice: 3.20   },

  // ─── Real Estate ──────────────────────────────────────────────────────────
  { ticker: 'TMGH',  yahoo: 'TMGH.CA',  nameEn: 'Talaat Moustafa Group Holding',       nameAr: 'طلعت مصطفى للتشييد والبناء',      sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 97.00  },
  { ticker: 'PHDC',  yahoo: 'PHDC.CA',  nameEn: 'Palm Hills Developments',             nameAr: 'بالم هيلز للتطوير العقاري',       sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 14.90  },
  { ticker: 'MASR',  yahoo: 'MASR.CA',  nameEn: 'Madinet Masr Housing & Development',  nameAr: 'مدينة مصر للإسكان والتعمير',      sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 7.70   },
  { ticker: 'OCDI',  yahoo: 'OCDI.CA',  nameEn: 'SODIC',                               nameAr: 'شركة أكتوبر للتنمية والاستثمار', sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 26.70 },
  { ticker: 'EMFD',  yahoo: 'EMFD.CA',  nameEn: 'Emaar Misr for Development',          nameAr: 'إعمار مصر للتطوير العقاري',       sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 11.90  },
  { ticker: 'ORHD',  yahoo: 'ORHD.CA',  nameEn: 'Ora Developers Egypt',               nameAr: 'أورا ديفلوبرز مصر',              sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 39.00  },
  { ticker: 'HELI',  yahoo: 'HELI.CA',  nameEn: 'Heliopolis Housing',                  nameAr: 'مصر الجديدة للإسكان والتعمير',   sector: 'Real Estate',           industry: 'Real Estate',             fallbackPrice: 7.30   },
  { ticker: 'ARCC',  yahoo: 'ARCC.CA',  nameEn: 'Arab Real Estate & Construction',     nameAr: 'العربية للتعمير والإنشاء',        sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 3.10   },
  { ticker: 'EGTS',  yahoo: 'EGTS.CA',  nameEn: 'Egyptian Tourism Resorts',            nameAr: 'المجمعات السياحية المصرية',       sector: 'Real Estate',           industry: 'Real Estate',             fallbackPrice: 5.40   },

  // ─── Telecommunications ───────────────────────────────────────────────────
  { ticker: 'ETEL',  yahoo: 'ETEL.CA',  nameEn: 'Telecom Egypt',                       nameAr: 'المصرية للاتصالات',               sector: 'Telecommunications',    industry: 'Fixed Line Telecoms',     fallbackPrice: 97.80  },

  // ─── Industrial ───────────────────────────────────────────────────────────
  { ticker: 'SWDY',  yahoo: 'SWDY.CA',  nameEn: 'El Sewedy Electric',                  nameAr: 'السويدي إليكتريك',               sector: 'Industrial',            industry: 'Electrical Equipment',       fallbackPrice: 89.00  },
  { ticker: 'EAST',  yahoo: 'EAST.CA',  nameEn: 'Eastern Company',                     nameAr: 'الشركة الشرقية للدخان',           sector: 'Industrial',            industry: 'Tobacco',                    fallbackPrice: 36.90  },
  { ticker: 'ORAS',  yahoo: 'ORAS.CA',  nameEn: 'Orascom Construction',                nameAr: 'أوراسكوم للإنشاء والصناعة',      sector: 'Industrial',            industry: 'Construction & Engineering', fallbackPrice: 691.00 },
  { ticker: 'MOIL',  yahoo: 'MOIL.CA',  nameEn: 'Maridive & Oil Services',             nameAr: 'ماريديف والنفط للخدمات',          sector: 'Industrial',            industry: 'Oil Services',               fallbackPrice: 0.50   },
  { ticker: 'EGAL',  yahoo: 'EGAL.CA',  nameEn: 'Egypt Aluminum',                      nameAr: 'مصر للألومنيوم',                  sector: 'Industrial',            industry: 'Aluminum',                   fallbackPrice: 293.00 },
  { ticker: 'OLFI',  yahoo: 'OLFI.CA',  nameEn: 'Olympic Group for Financial Investments', nameAr: 'المجموعة الأوليمبية للاستثمارات', sector: 'Industrial',         industry: 'Diversified Industrials',    fallbackPrice: 8.50   },
  { ticker: 'MPRC',  yahoo: 'MPRC.CA',  nameEn: 'Misr Printing & Packaging',           nameAr: 'مصر للطباعة والتغليف',            sector: 'Industrial',            industry: 'Packaging & Containers',     fallbackPrice: 23.00  },
  { ticker: 'ESRS',  yahoo: 'ESRS.CA',  nameEn: 'Ezz Steel',                           nameAr: 'عز للصلب',                        sector: 'Industrial',            industry: 'Metals & Mining',            fallbackPrice: 19.00  },

  // ─── Chemicals & Fertilizers ──────────────────────────────────────────────
  { ticker: 'ABUK',  yahoo: 'ABUK.CA',  nameEn: 'Abu Kir Fertilizers & Chemical Industries', nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',    fallbackPrice: 70.00  },
  { ticker: 'SKPC',  yahoo: 'SKPC.CA',  nameEn: 'Sidi Kerir Petrochemicals',           nameAr: 'سيدي كرير للبتروكيماويات',        sector: 'Chemicals & Fertilizers', industry: 'Petrochemicals',   fallbackPrice: 16.20  },
  { ticker: 'MFPC',  yahoo: 'MFPC.CA',  nameEn: 'Misr Fertilizers Production (MOPCO)',  nameAr: 'موبكو لإنتاج الأسمدة',           sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 37.00  },
  { ticker: 'EGCH',  yahoo: 'EGCH.CA',  nameEn: 'Egyptian Chemical Industries (KIMA)',  nameAr: 'الصناعات الكيماوية المصرية كيما', sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 13.00  },
  { ticker: 'PACH',  yahoo: 'PACH.CA',  nameEn: 'Egyptian Paints (Pachin)',             nameAr: 'باتشين للدهانات المصرية',          sector: 'Chemicals & Fertilizers', industry: 'Paints & Coatings', fallbackPrice: 55.00  },

  // ─── Energy ───────────────────────────────────────────────────────────────
  { ticker: 'AMOC',  yahoo: 'AMOC.CA',  nameEn: 'Alexandria Mineral Oils Company',     nameAr: 'الإسكندرية للزيوت المعدنية',      sector: 'Energy',                industry: 'Oil Refining',            fallbackPrice: 7.90   },
  { ticker: 'INFI',  yahoo: 'INFI.CA',  nameEn: 'Infinity Energy',                     nameAr: 'إنفينيتي للطاقة',                 sector: 'Energy',                industry: 'Renewable Energy',        fallbackPrice: 12.80  },

  // ─── Construction Materials ───────────────────────────────────────────────
  { ticker: 'SUCE',  yahoo: 'SUCE.CA',  nameEn: 'Suez Cement',                         nameAr: 'أسمنت السويس',                   sector: 'Construction Materials', industry: 'Cement',                  fallbackPrice: 19.00  },
  { ticker: 'MCQE',  yahoo: 'MCQE.CA',  nameEn: 'Misr Cement (Qena)',                  nameAr: 'أسمنت مصر قنا',                  sector: 'Construction Materials', industry: 'Cement',                  fallbackPrice: 178.00 },
  { ticker: 'LCSW',  yahoo: 'LCSW.CA',  nameEn: 'Lecico Egypt',                        nameAr: 'ليسيكو مصر للسيراميك',           sector: 'Construction Materials', industry: 'Ceramics & Tiles',        fallbackPrice: 31.50  },
  { ticker: 'ASPI',  yahoo: 'ASPI.CA',  nameEn: 'ASEC Holding',                        nameAr: 'أسيك القابضة',                    sector: 'Construction Materials', industry: 'Cement',                  fallbackPrice: 3.40   },
  { ticker: 'CERA',  yahoo: 'CERA.CA',  nameEn: 'Ceramica Cleopatra Group',            nameAr: 'كليوباترا للسيراميك',             sector: 'Construction Materials', industry: 'Ceramics & Tiles',        fallbackPrice: 17.50  },

  // ─── Healthcare ───────────────────────────────────────────────────────────
  { ticker: 'CLHO',  yahoo: 'CLHO.CA',  nameEn: 'Cleopatra Hospital Group',            nameAr: 'مجموعة مستشفيات كليوباترا',       sector: 'Healthcare',            industry: 'Hospitals',               fallbackPrice: 16.37  },
  { ticker: 'PHAR',  yahoo: 'PHAR.CA',  nameEn: 'EIPICO',                              nameAr: 'الشركة المصرية الدولية للأدوية', sector: 'Healthcare',            industry: 'Pharmaceuticals',         fallbackPrice: 86.00  },
  { ticker: 'SPMD',  yahoo: 'SPMD.CA',  nameEn: 'Speed Medical',                       nameAr: 'سبيد ميدكال للتشخيص',            sector: 'Healthcare',            industry: 'Diagnostics',             fallbackPrice: 0.45   },
  { ticker: 'RMDA',  yahoo: 'RMDA.CA',  nameEn: 'Rameda Pharmaceutical',               nameAr: 'راميدا للأدوية',                  sector: 'Healthcare',            industry: 'Pharmaceuticals',         fallbackPrice: 3.60   },
  { ticker: 'ISPH',  yahoo: 'ISPH.CA',  nameEn: 'Ibn Sina Pharma',                     nameAr: 'ابن سينا للأدوية والمستلزمات',    sector: 'Healthcare',            industry: 'Pharmaceuticals',         fallbackPrice: 26.00  },

  // ─── Food & Beverage ──────────────────────────────────────────────────────
  { ticker: 'JUFO',  yahoo: 'JUFO.CA',  nameEn: 'Juhayna Food Industries',             nameAr: 'جهينة للأغذية والألبان',          sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 30.90  },
  { ticker: 'DOMT',  yahoo: 'DOMT.CA',  nameEn: 'Domty',                               nameAr: 'الشركة العربية لصناعات الأغذية دومتي', sector: 'Food & Beverage', industry: 'Food Production',     fallbackPrice: 26.90  },
  { ticker: 'EKHO',  yahoo: 'EKHO.CA',  nameEn: 'Edita Food Industries',               nameAr: 'أديتا للصناعات الغذائية',         sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 22.50  },
  { ticker: 'POUL',  yahoo: 'POUL.CA',  nameEn: 'Cairo Poultry Group',                 nameAr: 'القاهرة للدواجن',                 sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 10.20  },
  { ticker: 'AJWA',  yahoo: 'AJWA.CA',  nameEn: 'Ajwa Group for Food Industries',      nameAr: 'مجموعة أجواء للصناعات الغذائية', sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 17.40  },
  { ticker: 'KABO',  yahoo: 'KABO.CA',  nameEn: 'Kabo International',                  nameAr: 'كابو للتجارة الدولية',            sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 7.00   },

  // ─── Technology ───────────────────────────────────────────────────────────
  { ticker: 'FWRY',  yahoo: 'FWRY.CA',  nameEn: 'Fawry for Banking Technology & Electronic Payment', nameAr: 'فوري للبنوك والمدفوعات الإلكترونية', sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 19.36 },
  { ticker: 'EFIH',  yahoo: 'EFIH.CA',  nameEn: 'e-finance for Digital & Financial Investments',     nameAr: 'إي فاينانس للاستثمارات الرقمية',      sector: 'Technology', industry: 'Digital Finance',     fallbackPrice: 22.00 },
  { ticker: 'RTVC',  yahoo: 'RTVC.CA',  nameEn: 'Raya Contact Center',                 nameAr: 'رايا للاتصالات وتقنية المعلومات', sector: 'Technology',            industry: 'Technology Services',     fallbackPrice: 3.10   },

  // ─── Textile ──────────────────────────────────────────────────────────────
  { ticker: 'ORWE',  yahoo: 'ORWE.CA',  nameEn: 'Oriental Weavers',                    nameAr: 'الشرقية للسجاد',                  sector: 'Textile',               industry: 'Carpets & Flooring',      fallbackPrice: 22.80  },
  { ticker: 'DSCW',  yahoo: 'DSCW.CA',  nameEn: 'Dice Sport & Casual Wear',            nameAr: 'دايس للملابس الرياضية',           sector: 'Textile',               industry: 'Apparel',                 fallbackPrice: 1.50   },
  { ticker: 'ACGC',  yahoo: 'ACGC.CA',  nameEn: 'Arab Cotton Ginning',                 nameAr: 'العربية لحلج الأقطان',            sector: 'Textile',               industry: 'Agriculture & Textiles',  fallbackPrice: 5.20   },

  // ─── Transportation ───────────────────────────────────────────────────────
  { ticker: 'ALCN',  yahoo: 'ALCN.CA',  nameEn: 'Alexandria Container & Cargo Handling', nameAr: 'الإسكندرية للحاويات والشحن',     sector: 'Transportation',        industry: 'Marine Shipping',         fallbackPrice: 29.00  },
];

// ─── EGX Index Membership ─────────────────────────────────────────────────────

export type EGXIndex = 'All' | 'EGX 30' | 'EGX 70';
export const EGX_INDICES: EGXIndex[] = ['All', 'EGX 30', 'EGX 70'];

// EGX 30 — blue-chip large-cap index (30 stocks)
export const EGX_30_TICKERS = new Set<string>([
  'COMI', 'CIEB', 'ADIB', 'HDBK', 'QNBE',  // Banking
  'HRHO', 'EFIH',                             // Financial Services
  'TMGH', 'PHDC', 'MASR', 'OCDI', 'EMFD', 'ORHD', 'HELI',  // Real Estate
  'ETEL',                                     // Telecoms
  'SWDY', 'EAST', 'ORAS', 'ESRS',            // Industrial
  'ABUK', 'SKPC',                             // Chemicals
  'AMOC',                                     // Energy
  'LCSW',                                     // Construction
  'CLHO', 'SPMD',                             // Healthcare
  'JUFO', 'EKHO',                             // Food & Beverage
  'FWRY',                                     // Technology
  'ORWE',                                     // Textile
  'ALCN',                                     // Transportation
]);

// EGX 70 — equal-weighted mid-cap index; all remaining companies in our database
export const EGX_70_TICKERS = new Set<string>(
  EGX_COMPANIES.filter(c => !EGX_30_TICKERS.has(c.ticker)).map(c => c.ticker)
);

export function getIndexCounts(): Record<string, number> {
  return {
    All: EGX_COMPANIES.length,
    'EGX 30': EGX_30_TICKERS.size,
    'EGX 70': EGX_70_TICKERS.size,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSectorCompanies(sector: EGXSector): EGXCompany[] {
  if (sector === 'All') return EGX_COMPANIES;
  return EGX_COMPANIES.filter(c => c.sector === sector);
}

export function getSectorCounts(): Record<string, number> {
  const counts: Record<string, number> = { All: EGX_COMPANIES.length };
  for (const c of EGX_COMPANIES) counts[c.sector] = (counts[c.sector] ?? 0) + 1;
  return counts;
}

export function searchCompanies(query: string): EGXCompany[] {
  const q = query.toLowerCase();
  return EGX_COMPANIES.filter(
    c => c.ticker.toLowerCase().includes(q) ||
         c.nameEn.toLowerCase().includes(q) ||
         c.nameAr.includes(q)
  );
}

// ─── Market Status ────────────────────────────────────────────────────────────

export type EGXSession = 'pre' | 'open' | 'post' | 'closed';

export interface EGXMarketStatus {
  session: EGXSession;
  label: string;
  nextEvent: string;
}

export function getEGXMarketStatus(): EGXMarketStatus {
  const now = new Date();
  const cairo = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const day = cairo.getDay();
  const h = cairo.getHours();
  const m = cairo.getMinutes();
  const mins = h * 60 + m;

  const PRE_OPEN  = 9  * 60 + 30;
  const OPEN      = 10 * 60;
  const CLOSE     = 14 * 60 + 30;
  const POST_CLOSE = 15 * 60;

  const isWeekday = day >= 0 && day <= 4; // Sun–Thu

  if (!isWeekday) {
    return { session: 'closed', label: 'Closed', nextEvent: 'Opens Sunday 10:00' };
  }
  if (mins < PRE_OPEN) {
    return { session: 'closed', label: 'Closed', nextEvent: `Pre-session at 09:30` };
  }
  if (mins < OPEN) {
    return { session: 'pre', label: 'Pre-Session', nextEvent: 'Opens at 10:00' };
  }
  if (mins < CLOSE) {
    const rem = CLOSE - mins;
    return { session: 'open', label: 'Open', nextEvent: `Closes in ${Math.floor(rem / 60)}h ${rem % 60}m` };
  }
  if (mins < POST_CLOSE) {
    return { session: 'post', label: 'Post-Session', nextEvent: 'Closes at 15:00' };
  }
  return { session: 'closed', label: 'Closed', nextEvent: 'Opens tomorrow 10:00' };
}
