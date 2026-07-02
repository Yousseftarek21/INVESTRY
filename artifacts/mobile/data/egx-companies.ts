// Egyptian Exchange (EGX) — complete company database
// Yahoo Finance uses the `.CA` suffix for Cairo Exchange listings

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
  'Automotive',
  'Education',
  'Tourism',
  'Transportation',
  'Insurance',
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
  { ticker: 'COMI',  yahoo: 'COMI.CA',   nameEn: 'Commercial International Bank', nameAr: 'البنك التجاري الدولي',              sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 95.80  },
  { ticker: 'QNBA',  yahoo: 'QNBA.CA',   nameEn: 'QNB Al Ahli Bank',              nameAr: 'بنك قطر الوطني الأهلي',            sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 60.20  },
  { ticker: 'CRED',  yahoo: 'CRED.CA',   nameEn: 'Credit Agricole Egypt',         nameAr: 'كريدي أجريكول مصر',               sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 55.40  },
  { ticker: 'ADIB',  yahoo: 'ADIB.CA',   nameEn: 'Abu Dhabi Islamic Bank Egypt',  nameAr: 'بنك أبو ظبي الإسلامي مصر',        sector: 'Banking',               industry: 'Islamic Banking',         fallbackPrice: 22.50  },
  { ticker: 'HDBK',  yahoo: 'HDBK.CA',   nameEn: 'Housing & Development Bank',    nameAr: 'بنك التعمير والإسكان',             sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 18.90  },
  { ticker: 'AIBD',  yahoo: 'AIBD.CA',   nameEn: 'Arab Investment Bank',          nameAr: 'البنك العربي للاستثمار والتنمية',  sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 8.50   },
  { ticker: 'BLOM',  yahoo: 'BLOM.CA',   nameEn: 'Blom Bank Egypt',               nameAr: 'بلوم بنك مصر',                    sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 12.40  },
  { ticker: 'FABL',  yahoo: 'FABL.CA',   nameEn: 'First Abu Dhabi Bank Egypt',    nameAr: 'بنك أبوظبي الأول مصر',            sector: 'Banking',               industry: 'Banks',                   fallbackPrice: 18.75  },

  // ─── Financial Services ───────────────────────────────────────────────────
  { ticker: 'HRHO',  yahoo: 'HRHO.CA',   nameEn: 'EFG Hermes Holding',            nameAr: 'هيرميس للأوراق المالية',           sector: 'Financial Services',    industry: 'Investment Banking',      fallbackPrice: 35.50  },
  { ticker: 'EKHO',  yahoo: 'EKHO.CA',   nameEn: 'EK Holding',                    nameAr: 'المصرية الكويتية القابضة',         sector: 'Financial Services',    industry: 'Diversified Financials',  fallbackPrice: 18.75  },
  { ticker: 'CIBD',  yahoo: 'CIBD.CA',   nameEn: 'CI Capital Holding',            nameAr: 'سي آي كابيتال القابضة',           sector: 'Financial Services',    industry: 'Brokerage',               fallbackPrice: 4.20   },
  { ticker: 'EFID',  yahoo: 'EFID.CA',   nameEn: 'Egyptian Financial & Industrial', nameAr: 'المصرية المالية والصناعية',     sector: 'Financial Services',    industry: 'Diversified Financials',  fallbackPrice: 9.10   },
  { ticker: 'MNFN',  yahoo: 'MNFN.CA',   nameEn: 'Mena for Financial Investments', nameAr: 'مينا للاستثمارات المالية',       sector: 'Financial Services',    industry: 'Investment Holdings',     fallbackPrice: 2.85   },

  // ─── Real Estate ──────────────────────────────────────────────────────────
  { ticker: 'TMGH',  yahoo: 'TMGH.CA',   nameEn: 'Talaat Mostafa Group',          nameAr: 'طلعت مصطفى للتشييد والبناء',      sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 28.40  },
  { ticker: 'PHDC',  yahoo: 'PHDC.CA',   nameEn: 'Palm Hills Developments',       nameAr: 'بالم هيلز للتطوير العقاري',       sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 8.75   },
  { ticker: 'MNHD',  yahoo: 'MNHD.CA',   nameEn: 'Madinet Nasr Housing',          nameAr: 'مدينة نصر للإسكان والتعمير',      sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 19.40  },
  { ticker: 'OCDI',  yahoo: 'OCDI.CA',   nameEn: 'Orascom Development Egypt',     nameAr: 'أوراسكوم للتطوير مصر',           sector: 'Real Estate',           industry: 'Real Estate & Hospitality', fallbackPrice: 11.80 },
  { ticker: 'EMFD',  yahoo: 'EMFD.CA',   nameEn: 'Emaar Misr for Development',    nameAr: 'إعمار مصر للتطوير العقاري',       sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 7.20   },
  { ticker: 'ORHD',  yahoo: 'ORHD.CA',   nameEn: 'Ora Developers Egypt',          nameAr: 'أورا ديفلوبرز مصر',              sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 5.90   },
  { ticker: 'HELI',  yahoo: 'HELI.CA',   nameEn: 'Heliopolis Housing & Dev.',     nameAr: 'مصر الجديدة للإسكان والتعمير',   sector: 'Real Estate',           industry: 'Real Estate',             fallbackPrice: 42.00  },
  { ticker: 'DRTK',  yahoo: 'DRTK.CA',   nameEn: 'Delta for Real Estate & Tourism', nameAr: 'دلتا للعقارات والسياحة',      sector: 'Real Estate',           industry: 'Real Estate Development', fallbackPrice: 3.60   },

  // ─── Telecommunications ───────────────────────────────────────────────────
  { ticker: 'ETEL',  yahoo: 'ETEL.CA',   nameEn: 'Telecom Egypt',                 nameAr: 'المصرية للاتصالات',               sector: 'Telecommunications',    industry: 'Fixed Line Telecoms',     fallbackPrice: 24.50  },

  // ─── Industrial ───────────────────────────────────────────────────────────
  { ticker: 'SWDY',  yahoo: 'SWDY.CA',   nameEn: 'El Sewedy Electric',            nameAr: 'السويدي إليكتريك',               sector: 'Industrial',            industry: 'Electrical Equipment',    fallbackPrice: 42.10  },
  { ticker: 'ESRS',  yahoo: 'ESRS.CA',   nameEn: 'Ezz Steel',                     nameAr: 'حديد عز',                        sector: 'Industrial',            industry: 'Steel',                   fallbackPrice: 66.50  },
  { ticker: 'EAST',  yahoo: 'EAST.CA',   nameEn: 'Eastern Company',               nameAr: 'الشركة الشرقية للدخان',           sector: 'Industrial',            industry: 'Tobacco',                 fallbackPrice: 32.20  },
  { ticker: 'ORAS',  yahoo: 'ORAS.CA',   nameEn: 'Orascom Construction',          nameAr: 'أوراسكوم للإنشاء والصناعة',      sector: 'Industrial',            industry: 'Construction & Engineering', fallbackPrice: 52.60 },
  { ticker: 'MFPC',  yahoo: 'MFPC.CA',   nameEn: 'Maridive & Oil Services',       nameAr: 'ماريديف والنفط للخدمات',          sector: 'Industrial',            industry: 'Oil Services',            fallbackPrice: 7.90   },

  // ─── Chemicals & Fertilizers ──────────────────────────────────────────────
  { ticker: 'ABUK',  yahoo: 'ABUK.CA',   nameEn: 'Abu Kir Fertilizers',           nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',        fallbackPrice: 180.50 },
  { ticker: 'SKPC',  yahoo: 'SKPC.CA',   nameEn: 'Sidi Kerir Petrochemicals',     nameAr: 'سيدي كرير للبتروكيماويات',        sector: 'Chemicals & Fertilizers', industry: 'Petrochemicals',     fallbackPrice: 55.00  },
  { ticker: 'MOPCO', yahoo: 'MOPCO.CA',  nameEn: 'Misr Fertilizers Production',   nameAr: 'موبكو لإنتاج الأسمدة',           sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',        fallbackPrice: 280.00 },

  // ─── Energy ───────────────────────────────────────────────────────────────
  { ticker: 'AMOC',  yahoo: 'AMOC.CA',   nameEn: 'Alexandria Mineral Oils',       nameAr: 'الإسكندرية للزيوت المعدنية',      sector: 'Energy',                industry: 'Oil Refining',            fallbackPrice: 118.00 },
  { ticker: 'PRSM',  yahoo: 'PRSM.CA',   nameEn: 'Petrojet',                      nameAr: 'بتروجيت للخدمات البترولية',       sector: 'Energy',                industry: 'Oil Services',            fallbackPrice: 14.50  },

  // ─── Construction Materials ───────────────────────────────────────────────
  { ticker: 'STMR',  yahoo: 'STMR.CA',   nameEn: 'Suez Cement',                   nameAr: 'أسمنت السويس',                   sector: 'Construction Materials', industry: 'Cement',                 fallbackPrice: 15.80  },
  { ticker: 'MCEM',  yahoo: 'MCEM.CA',   nameEn: 'Misr Cement (Qena)',             nameAr: 'أسمنت مصر قنا',                  sector: 'Construction Materials', industry: 'Cement',                 fallbackPrice: 35.00  },
  { ticker: 'LCSW',  yahoo: 'LCSW.CA',   nameEn: 'Lecico Egypt',                  nameAr: 'ليسيكو مصر للسيراميك',           sector: 'Construction Materials', industry: 'Ceramics & Tiles',       fallbackPrice: 5.40   },
  { ticker: 'EGCH',  yahoo: 'EGCH.CA',   nameEn: 'Egyptian Cement',               nameAr: 'الإسمنت المصري',                 sector: 'Construction Materials', industry: 'Cement',                 fallbackPrice: 7.20   },

  // ─── Healthcare ───────────────────────────────────────────────────────────
  { ticker: 'CLHO',  yahoo: 'CLHO.CA',   nameEn: 'Cleopatra Hospital Group',      nameAr: 'مجموعة مستشفيات كليوباترا',       sector: 'Healthcare',            industry: 'Hospitals',               fallbackPrice: 11.30  },
  { ticker: 'ISPH',  yahoo: 'ISPH.CA',   nameEn: 'EIPICO',                        nameAr: 'الشركة المصرية الدولية للأدوية', sector: 'Healthcare',            industry: 'Pharmaceuticals',         fallbackPrice: 48.00  },
  { ticker: 'SPMD',  yahoo: 'SPMD.CA',   nameEn: 'Speed Medical',                 nameAr: 'سبيد ميدكال للتشخيص',            sector: 'Healthcare',            industry: 'Diagnostics',             fallbackPrice: 15.20  },
  { ticker: 'IDHC',  yahoo: 'IDHC.CA',   nameEn: 'Integrated Diagnostics (IDH)',  nameAr: 'المجمعة للتشخيص الطبي',           sector: 'Healthcare',            industry: 'Diagnostics',             fallbackPrice: 23.50  },
  { ticker: 'AMPH',  yahoo: 'AMPH.CA',   nameEn: 'Amoun Pharmaceutical',          nameAr: 'عمون للصناعات الدوائية',          sector: 'Healthcare',            industry: 'Pharmaceuticals',         fallbackPrice: 82.00  },

  // ─── Food & Beverage ──────────────────────────────────────────────────────
  { ticker: 'JUFO',  yahoo: 'JUFO.CA',   nameEn: 'Juhayna Food Industries',       nameAr: 'جهينة للأغذية والألبان',          sector: 'Food & Beverage',       industry: 'Food Production',         fallbackPrice: 12.60  },
  { ticker: 'DOMTY', yahoo: 'DOMTY.CA',  nameEn: 'Arabian Food Industries',       nameAr: 'الشركة العربية لصناعات الأغذية (دومتي)', sector: 'Food & Beverage', industry: 'Food Production',     fallbackPrice: 9.80   },
  { ticker: 'EGAL',  yahoo: 'EGAL.CA',   nameEn: 'Egypt Aluminum',                nameAr: 'مصر للألومنيوم',                  sector: 'Industrial',            industry: 'Aluminum',                fallbackPrice: 28.50  },

  // ─── Technology ───────────────────────────────────────────────────────────
  { ticker: 'FWRY',  yahoo: 'FWRY.CA',   nameEn: 'Fawry for Banking & Payment',   nameAr: 'فوري للبنوك والمدفوعات الإلكترونية', sector: 'Technology',         industry: 'Payment Technology',      fallbackPrice: 29.80  },

  // ─── Textile ──────────────────────────────────────────────────────────────
  { ticker: 'ORWE',  yahoo: 'ORWE.CA',   nameEn: 'Oriental Weavers',              nameAr: 'الشرقية للسجاد',                  sector: 'Textile',               industry: 'Carpets & Flooring',      fallbackPrice: 14.90  },
  { ticker: 'GTHE',  yahoo: 'GTHE.CA',   nameEn: 'Ghazl El Mahalla',              nameAr: 'غزل المحلة',                      sector: 'Textile',               industry: 'Spinning & Weaving',      fallbackPrice: 2.40   },

  // ─── Automotive ───────────────────────────────────────────────────────────
  { ticker: 'GAMA',  yahoo: 'GAMA.CA',   nameEn: 'Ghabbour Auto',                 nameAr: 'غبور أوتو للسيارات',              sector: 'Automotive',            industry: 'Automobiles & Parts',     fallbackPrice: 5.40   },

  // ─── Education ────────────────────────────────────────────────────────────
  { ticker: 'CIRA',  yahoo: 'CIRA.CA',   nameEn: 'CIRA Education',                nameAr: 'سيرا للتعليم',                    sector: 'Education',             industry: 'Education Services',      fallbackPrice: 23.10  },

  // ─── Tourism ──────────────────────────────────────────────────────────────
  { ticker: 'EGTS',  yahoo: 'EGTS.CA',   nameEn: 'Egyptian Resorts Company',      nameAr: 'الشركة المصرية للمنتجعات السياحية', sector: 'Tourism',             industry: 'Hotels & Entertainment',  fallbackPrice: 4.80   },

  // ─── Transportation ───────────────────────────────────────────────────────
  { ticker: 'ACGC',  yahoo: 'ACGC.CA',   nameEn: 'Alexandria Container & Cargo',  nameAr: 'الإسكندرية للحاويات والشحن',      sector: 'Transportation',        industry: 'Marine Shipping',         fallbackPrice: 32.50  },

  // ─── Insurance ────────────────────────────────────────────────────────────
  { ticker: 'EGYI',  yahoo: 'EGYI.CA',   nameEn: 'Egyptian Takaful - Property',   nameAr: 'مصر تكافل للتأمين على الممتلكات', sector: 'Insurance',             industry: 'Property Insurance',      fallbackPrice: 6.90   },
  { ticker: 'GLNA',  yahoo: 'GLNA.CA',   nameEn: 'GlassEgypt',                    nameAr: 'زجاج مصر',                        sector: 'Construction Materials', industry: 'Glass Products',          fallbackPrice: 11.20  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSectorCompanies(sector: EGXSector): EGXCompany[] {
  if (sector === 'All') return EGX_COMPANIES;
  return EGX_COMPANIES.filter(c => c.sector === sector);
}

export function getSectorCounts(): Record<string, number> {
  const counts: Record<string, number> = { All: EGX_COMPANIES.length };
  for (const c of EGX_COMPANIES) {
    counts[c.sector] = (counts[c.sector] ?? 0) + 1;
  }
  return counts;
}

export function searchCompanies(query: string): EGXCompany[] {
  if (!query.trim()) return EGX_COMPANIES;
  const q = query.toLowerCase().trim();
  return EGX_COMPANIES.filter(c =>
    c.ticker.toLowerCase().includes(q) ||
    c.nameEn.toLowerCase().includes(q) ||
    c.nameAr.includes(q) ||
    c.sector.toLowerCase().includes(q) ||
    c.industry.toLowerCase().includes(q)
  );
}

// EGX trading hours: Sunday–Thursday 10:00–15:30 Cairo time (UTC+2)
export function getEGXMarketStatus(): { isOpen: boolean; label: string; nextEvent: string } {
  const cairo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const day = cairo.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  const h = cairo.getHours();
  const m = cairo.getMinutes();
  const time = h * 60 + m;
  const open  = 10 * 60;       // 10:00
  const close = 15 * 60 + 30;  // 15:30
  const isWeekday = day >= 0 && day <= 4;

  if (isWeekday && time >= open && time < close) {
    return { isOpen: true, label: 'Open', nextEvent: `Closes at 3:30 PM` };
  }
  const daysUntilSun = day === 5 ? 1 : day === 6 ? 0 : 0;
  return {
    isOpen: false,
    label: 'Closed',
    nextEvent: day === 5 ? 'Opens Sunday 10:00 AM' : day === 6 ? 'Opens Tomorrow 10:00 AM' : 'Opens 10:00 AM',
  };
}
