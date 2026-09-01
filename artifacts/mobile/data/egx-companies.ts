// Egyptian Exchange (EGX) — verified company database
// Tickers and English names sourced from TradingView Egypt scanner
// 282 active stocks with live prices via TradingView scanner

export const EGX_SECTORS = [
  'All',
  'Banking',
  'Financial Services',
  'Real Estate',
  'Hotels & Tourism',
  'Telecommunications',
  'Industrial',
  'Chemicals & Fertilizers',
  'Energy',
  'Construction Materials',
  'Healthcare',
  'Food & Beverage',
  'Technology',
  'Textile',
  'Agriculture',
  'Insurance',
  'Education',
  'Transportation',
] as const;

export type EGXSector = typeof EGX_SECTORS[number];

export interface EGXCompany {
  ticker: string;
  nameEn: string;
  nameAr: string;
  sector: Exclude<EGXSector, 'All'>;
  industry: string;
  fallbackPrice: number;
}

export const EGX_COMPANIES: EGXCompany[] = [

  // ─── Banking (13) ─────────────────────────────────────────────────────────
  { ticker: 'COMI',  nameEn: 'Commercial International Bank - Egypt (CIB) S.A.E.',     nameAr: 'البنك التجاري الدولي (CIB)',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 136.90 },
  { ticker: 'CIEB',  nameEn: 'Credit Agricole Egypt',                   nameAr: 'كريدي أجريكول مصر',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 24.40  },
  { ticker: 'ADIB',  nameEn: 'Abu Dhabi Islamic Bank-Egypt',             nameAr: 'بنك أبو ظبي الإسلامي مصر',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 46.50  },
  { ticker: 'HDBK',  nameEn: 'Housing & Development Bank',              nameAr: 'بنك التعمير والإسكان',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 78.03  },
  { ticker: 'QNBE',  nameEn: 'Qatar National Bank',                              nameAr: 'بنك قطر الوطني الأهلي',                         sector: 'Banking', industry: 'Banks',          fallbackPrice: 54.90  },
  { ticker: 'NBKE',  nameEn: 'National Bank of Kuwait - Egypt',           nameAr: 'بنك الكويت الوطني مصر',                  sector: 'Banking', industry: 'Banks',          fallbackPrice: 32.40  },
  { ticker: 'CANA',  nameEn: 'Suez Canal Bank SAE',                         nameAr: 'بنك قناة السويس',                        sector: 'Banking', industry: 'Banks',          fallbackPrice: 36.12  },
  { ticker: 'SAIB',  nameEn: 'Societe Arabe Internationale de Banque', nameAr: 'الشركة العربية الدولية للبنوك',           sector: 'Banking', industry: 'Banks',          fallbackPrice: 2.11   },
  { ticker: 'UBEE',  nameEn: 'United Bank SAE',                             nameAr: 'البنك المتحد',                           sector: 'Banking', industry: 'Banks',          fallbackPrice: 13.40  },
  { ticker: 'EXPA',  nameEn: 'Export Development Bank of Egypt',        nameAr: 'بنك تنمية الصادرات',                     sector: 'Banking', industry: 'Banks',          fallbackPrice: 18.69  },
  { ticker: 'EGBE',  nameEn: 'Egyptian Gulf Bank',                      nameAr: 'بنك الخليج المصري',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 0.46   },
  { ticker: 'FAIT',  nameEn: 'Faisal Islamic Bank of Egypt',            nameAr: 'بنك فيصل الإسلامي المصري',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 37.13  },
  { ticker: 'FAITA', nameEn: 'Faisal Islamic Bank of Egypt', nameAr: 'بنك فيصل الإسلامي المصري (فئة ب)',      sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 0.98   },

  // ─── Financial Services (40) ──────────────────────────────────────────────
  { ticker: 'HRHO',  nameEn: 'EFG Holding S.A.E.',                             nameAr: 'إي إف جي القابضة',                 sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 26.66  },
  { ticker: 'CICH',  nameEn: 'CI Capital Holding for Financial Investments',                      nameAr: 'سي آي كابيتال للاستثمارات المالية',                  sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 12.00  },
  { ticker: 'EFIC',  nameEn: 'Egyptian Financial & Industrial Co.',     nameAr: 'المصرية المالية والصناعية',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 187.70 },
  { ticker: 'GBCO',  nameEn: 'GB Corp',                                 nameAr: 'جي بي كوربوريشن',                        sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 31.81  },
  { ticker: 'CCAP',  nameEn: 'QALA For Financial Investments',          nameAr: 'قلعة للاستثمارات المالية',                sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 5.36   },
  { ticker: 'BINV',  nameEn: 'B Investments Holding SAE',                   nameAr: 'بي إنفستمنتس القابضة',                   sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 48.88  },
  { ticker: 'BTFH',  nameEn: 'Beltone Holding',                         nameAr: 'بلتون القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 3.05   },
  { ticker: 'CNFN',  nameEn: 'Contact Financial Holding SAE',               nameAr: 'كونتاكت للاستثمار المالي القابضة',               sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 4.91   },
  { ticker: 'ACTF',  nameEn: 'Act Financial',                           nameAr: 'أكت للاستثمارات المالية',                sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 2.77   },
  { ticker: 'ASPI',  nameEn: 'Aspire Capital Holding for Financial Investments',                  nameAr: 'أسباير كابيتال للاستثمارات المالية',     sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.31   },
  { ticker: 'ATLC',  nameEn: 'Al Tawfeek Leasing Company-A.T.LEASE',                      nameAr: 'التوفيق للتأجير التمويلي',               sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 5.24   },
  { ticker: 'VALU',  nameEn: 'U Consumer Finance S.A.E',                      nameAr: 'يو للتمويل الاستهلاكي',                  sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 12.80  },
  { ticker: 'RAYA',  nameEn: 'Raya Holding for Financial Investments SAE',  nameAr: 'رايا القابضة للاستثمارات المالية',        sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.29   },
  { ticker: 'ICLE',  nameEn: 'International Co. for Leasing SAE',           nameAr: 'الشركة الدولية للتأجير التمويلي',        sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 15.76  },
  { ticker: 'ICFC',  nameEn: 'International Co. for Fertilizers & Chemicals', nameAr: 'الشركة الدولية للأسمدة والكيماويات', sector: 'Financial Services', industry: 'Diversified Financials', fallbackPrice: 15.09 },
  { ticker: 'MKIT',  nameEn: 'Misr Kuwait Investment & Trading Co.',        nameAr: 'مصر الكويت للاستثمار والتجارة',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.74   },
  { ticker: 'KWIN',  nameEn: 'El Kahera El Watania Investment',          nameAr: 'القاهرة الوطنية للاستثمار',              sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 68.86  },
  { ticker: 'NAHO',  nameEn: 'Naeem Holding Co.',                            nameAr: 'نعيم القابضة',                           sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.10   },
  { ticker: 'ODIN',  nameEn: 'ODIN Investments',                         nameAr: 'أودين للاستثمارات',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.48   },
  { ticker: 'OFH',   nameEn: 'O B Financial Holding',                     nameAr: 'أو بي القابضة للاستثمارات المالية',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.63   },
  { ticker: 'OIH',   nameEn: 'Orascom Investment Holding SAE',               nameAr: 'أوراسكوم للاستثمار القابضة',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 1.41   },
  { ticker: 'PRMH',  nameEn: 'Prime Holding',                            nameAr: 'برايم القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.74   },
  { ticker: 'RKAZ',  nameEn: 'REKAZ Financial Holding',                  nameAr: 'ركاز القابضة للاستثمار المالي',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 4.80   },
  { ticker: 'TYCN',  nameEn: 'Tycoon Holding Company For Financial Investments',                           nameAr: 'تايكون للاستثمارات المالية القابضة',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 23.26  },
  { ticker: 'TWSA',  nameEn: 'TAWASOA FOR FACTORING',                    nameAr: 'تواصل للتخصيم',                          sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 6.70   },
  { ticker: 'GRCA',  nameEn: 'Grand Investment Capital',                 nameAr: 'جراند للاستثمار الرأسمالي',              sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 51.49  },
  { ticker: 'HAVC',  nameEn: 'Hassan Allam Investments & Venture Capital S.A.E', nameAr: 'حسن علام للاستثمارات ورأس المال المخاطر', sector: 'Financial Services', industry: 'Investment Banking',   fallbackPrice: 1.00   },
  { ticker: 'LKGP',  nameEn: 'The Holding Company for Financial Investment - The Lakah Group',                      nameAr: 'مجموعة لقا للاستثمارات المالية القابضة',                     sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.50   },
  { ticker: 'SEIG',  nameEn: 'Saudi Egyptian Investment & Finance Co. SAE',      nameAr: 'السعودية المصرية للاستثمار والتمويل',    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 259.07 },
  { ticker: 'SEIGA', nameEn: 'Saudi Egyptian Investment & Finance Co. SAE',  nameAr: 'السعودية المصرية للاستثمار والتمويل (فئة أ)', sector: 'Financial Services', industry: 'Investment Banking',     fallbackPrice: 0.95   },
  { ticker: 'VLMR',  nameEn: 'Valmore Holding',                          nameAr: 'فالمور القابضة',                         sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.66   },
  { ticker: 'VLMRA', nameEn: 'Valmore Holding',                       nameAr: 'فالمور القابضة (فئة أ)',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 29.01  },
  { ticker: 'OCAP',  nameEn: 'OG Capital For Investments SPAC',               nameAr: 'أو جي كابيتال للاستثمارات',             sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 1.00   },
  { ticker: 'EASB',  nameEn: 'Egyptian Arabian Company for Securities Brokerage EAC',    nameAr: 'الشركة المصرية العربية للوساطة في الأوراق المالية',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 7.17   },
  { ticker: 'EBSC',  nameEn: 'Osool ESB Securities Brokerage',           nameAr: 'أصول للوساطة في الأوراق المالية',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.92   },
  { ticker: 'EOSB',  nameEn: 'El Orouba Securities Brokerage',           nameAr: 'العروبة للوساطة في الأوراق المالية',     sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.55   },
  { ticker: 'ACAMD', nameEn: 'Arab Co. for Asset Management & Development', nameAr: 'العربية لإدارة الأصول والتنمية',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.34   },
  { ticker: 'ACAP',  nameEn: 'A Capital Holding',                        nameAr: 'إيه كابيتال القابضة',                    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 9.14   },
  { ticker: 'HDST',  nameEn: 'HEDGESTONE INVESTMENT',                    nameAr: 'هيدج ستون للاستثمار',                    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.10   },
  { ticker: 'AIDC',  nameEn: 'Arabia for Investment and Development',    nameAr: 'العربية للاستثمار والتنمية',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.73   },
  { ticker: 'AIH',   nameEn: 'Arabia Investments Holding SAE',               nameAr: 'العربية للاستثمارات القابضة',            sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.48   },
  { ticker: 'AMIA',  nameEn: 'Arab Moltaqa Investments Company',                 nameAr: 'الملتقى العربي للاستثمارات',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.95   },
  { ticker: 'BIGP',  nameEn: 'ElBarbary Investment Group',               nameAr: 'مجموعة البربري للاستثمار',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.35   },
  { ticker: 'CPME',  nameEn: 'Catalyst Partners Middle East',            nameAr: 'كاتاليست بارتنرز الشرق الأوسط',         sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 15.35  },
  { ticker: 'IBCT',  nameEn: 'International Business Corp. for Trading & Agencies', nameAr: 'الشركة الدولية للأعمال والتجارة',       sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 13.39  },
  { ticker: 'KORA',  nameEn: 'KORRA',                                    nameAr: 'كورة',                                   sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.39   },
  { ticker: 'MAAL',  nameEn: 'Marseilla Al Masreia Al Khalegeya for Holding Investment', nameAr: 'مرسيلا المصرية الخليجية للاستثمار',    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.46   },

  // ─── Real Estate (35) ─────────────────────────────────────────────────────
  { ticker: 'TMGH',  nameEn: 'Talaat Moustafa Group Holding',            nameAr: 'طلعت مصطفى للتشييد والبناء',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 98.28  },
  { ticker: 'PHDC',  nameEn: 'Palm Hills Development Co.',                   nameAr: 'بالم هيلز للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 14.85  },
  { ticker: 'MASR',  nameEn: 'Madinet Masr for Housing & Development',   nameAr: 'مدينة مصر للإسكان والتعمير',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.20   },
  { ticker: 'OCDI',  nameEn: 'Six of October Development & Investment (SODIC)',                                    nameAr: 'سوديك للتطوير العقاري',        sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 27.08  },
  { ticker: 'EMFD',  nameEn: 'Emaar Misr for Development SAE',               nameAr: 'إعمار مصر للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 11.70  },
  { ticker: 'ORHD',  nameEn: 'Orascom Development Egypt (S.A.E)',               nameAr: 'أوراسكوم للتطوير مصر',                  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 39.20  },
  { ticker: 'HELI',  nameEn: 'Heliopolis Housing',                        nameAr: 'مصر الجديدة للإسكان والتعمير',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.35   },
  { ticker: 'EGTS',  nameEn: 'Egyptian for Tourism Resorts',             nameAr: 'المجمعات السياحية المصرية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 18.20  },
  { ticker: 'AMER',  nameEn: 'Amer Group Holding',                       nameAr: 'مجموعة عامر القابضة',                   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 3.16   },
  { ticker: 'UNIT',  nameEn: 'United Housing Construction SA',              nameAr: 'الاتحاد للإسكان والتعمير',              sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 19.06  },
  { ticker: 'ELSH',  nameEn: 'El-Shams Housing & Development SA',           nameAr: 'الشمس للإسكان والتعمير',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 14.60  },
  { ticker: 'EHDR',  nameEn: 'Egyptians Housing Development & Reconstruction', nameAr: 'مصر للإسكان والتعمير',           sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 2.67   },
  { ticker: 'IDRE',  nameEn: 'Ismailia Development & Real Estate Co.',       nameAr: 'الإسماعيلية الجديدة للتطوير العمراني', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 46.00  },
  { ticker: 'ZMID',  nameEn: 'Zahraa Maadi Investment & Development',   nameAr: 'زهراء المعادي للاستثمار والتعمير',      sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 7.26   },
  { ticker: 'RREI',  nameEn: 'Arab Real Estate Investment Co.',          nameAr: 'الاتحاد العقاري المصري',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.84   },
  { ticker: 'MENA',  nameEn: 'Mena Touristic & Real Estate Investment',  nameAr: 'مينا للاستثمار السياحي والعقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.05   },
  { ticker: 'RTVC',  nameEn: 'Remco for Touristic Villages Construction', nameAr: 'ريمكو للتجمعات السياحية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.86   },
  { ticker: 'AREH',  nameEn: 'Egyptian Real Estate Group',               nameAr: 'المجموعة المصرية للعقارات',             sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.71   },
  { ticker: 'BONY',  nameEn: 'Bonyan for Development and Trade',         nameAr: 'بنيان للتطوير والتجارة',                sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 4.83   },
  { ticker: 'CCRS',  nameEn: 'Gulf Canadian Real Estate Investment Co.',     nameAr: 'الخليج الكندي للاستثمار العقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.54   },
  { ticker: 'CRST',  nameEn: 'Creast Mark For Contracting And Real Estate Development',  nameAr: 'كريست مارك للمقاولات والتطوير العقاري', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.57   },
  { ticker: 'EGREF', nameEn: 'Egyptians Real Estate Fund',               nameAr: 'الصندوق المصري للعقارات',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 13.78  },
  { ticker: 'ELKA',  nameEn: 'El Kahera Housing',                        nameAr: 'القاهرة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.64   },
  { ticker: 'ELWA',  nameEn: 'Elwadi for International Investment & Development', nameAr: 'الوادي للاستثمار الدولي',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.09   },
  { ticker: 'FIRE',  nameEn: 'First Investment & Real Estate Development', nameAr: 'الأولى للاستثمار والتطوير العقاري',   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.45   },
  { ticker: 'GIHD',  nameEn: 'Gharbia Islamic Housing Development',      nameAr: 'الغربية الإسلامية للإسكان والتعمير',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 49.61  },
  { ticker: 'GPIM',  nameEn: 'GPI For Urban Growth',                     nameAr: 'جي بي آي للنمو العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.15   },
  { ticker: 'GPPL',  nameEn: 'Golden Pyramids Plaza',                    nameAr: 'هضبة الأهرام بلازا',                    sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.40   },
  { ticker: 'ICID',  nameEn: 'International Company for Investment & Development', nameAr: 'الشركة الدولية للاستثمار والتنمية', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.26 },
  { ticker: 'MMHC',  nameEn: 'El Mamoura Co For Egp10',                           nameAr: 'المعمورة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 10.00  },
  { ticker: 'NARE',  nameEn: 'Naeem Real Estate Holding Group',          nameAr: 'نعيم للاستثمار العقاري',                sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 19.52  },
  { ticker: 'NHPS',  nameEn: 'National Housing for Professional Syndicates', nameAr: 'الوطنية للإسكان للنقابات المهنية',  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 83.54  },
  { ticker: 'OBRI',  nameEn: 'El Obour Real Estate Investment',          nameAr: 'العبور للاستثمار العقاري',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 36.45  },
  { ticker: 'PRDC',  nameEn: 'Pioneers Properties for Urban Development', nameAr: 'رواد للتطوير العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.20   },
  { ticker: 'TANM',  nameEn: 'Tanmiya for Real Estate Investment',       nameAr: 'تنمية للاستثمار العقاري',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.83   },
  { ticker: 'UEGC',  nameEn: 'El-Saeed Contracting & Real Estate Investment Co. SCCD', nameAr: 'السعيد للمقاولات والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',          fallbackPrice: 1.91   },
  { ticker: 'UTOP',  nameEn: 'Utopia Real Estate Investment & Tourism SAE',  nameAr: 'يوتوبيا للاستثمار العقاري والسياحي',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 83.95  },
  { ticker: 'ADRI',  nameEn: 'Arab Development & Real Estate Investment', nameAr: 'العربية للتنمية والاستثمار العقاري',   sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.18   },
  { ticker: 'GGCC',  nameEn: 'Giza General Contracting & Real Estate Investment',   nameAr: 'الجيزة للمقاولات العامة والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',      fallbackPrice: 0.59   },
  { ticker: 'COPR',  nameEn: 'Cooper for Commercial Investment & Real Estate Development', nameAr: 'كوبر للاستثمار التجاري والعقاري', sector: 'Real Estate', industry: 'Real Estate',            fallbackPrice: 0.37   },
  { ticker: 'AFDI',  nameEn: 'Alahly For Development & Investment',      nameAr: 'الأهلي للتنمية والاستثمار',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 47.44  },

  // ─── Hotels & Tourism (11) ────────────────────────────────────────────────
  { ticker: 'EGOTH', nameEn: 'El Masreyah Touris Egp100',                      nameAr: 'المصرية للسياحة',                       sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 100.00 },
  { ticker: 'EITP',  nameEn: 'Egyptian International Tourism Projects',  nameAr: 'مشروعات السياحة الدولية المصرية',       sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 8.17   },
  { ticker: 'MHOT',  nameEn: 'Misr Hotels Co.',                              nameAr: 'مصر للفنادق',                           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 16.44  },
  { ticker: 'MITR',  nameEn: 'Misr Travel&Touris Egp6',                              nameAr: 'مصر للسفر والسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 6.00   },
  { ticker: 'MMAT',  nameEn: 'Marsa Marsa Alam for Tourism Development',           nameAr: 'مرسى علم للتطوير السياحي',              sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 3.70   },
  { ticker: 'PHTV',  nameEn: 'Pyramisa Hotels',                          nameAr: 'فنادق بيراميسا',                        sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 298.84 },
  { ticker: 'RMTV',  nameEn: 'Rowad Misr Tourism Investment',            nameAr: 'رواد مصر للاستثمار السياحي',            sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 100.00 },
  { ticker: 'ROTO',  nameEn: 'Rowad Tourism (Al Rowad) Co',                        nameAr: 'الرواد للسياحة',                        sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 43.07  },
  { ticker: 'SDTI',  nameEn: 'Sharm Dreams Co. for Tourism Investment',          nameAr: 'أحلام شرم للاستثمار السياحي',           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 47.05  },
  { ticker: 'SPHT',  nameEn: 'El Shams Pyramids Co. for Hotels & Touristic Projects SAE',       nameAr: 'الشمس والأهرامات للفنادق والمشاريع السياحية', sector: 'Hotels & Tourism', industry: 'Hotels', fallbackPrice: 1.91   },
  { ticker: 'TRTO',  nameEn: 'TransOceans Tours',                        nameAr: 'ترانس أوشن للسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 0.03   },

  // ─── Telecommunications (2) ───────────────────────────────────────────────
  { ticker: 'ETEL',  nameEn: 'Telecom Egypt',                            nameAr: 'المصرية للاتصالات',                     sector: 'Telecommunications', industry: 'Fixed Line Telecoms', fallbackPrice: 97.00 },
  { ticker: 'GTHE',  nameEn: 'Global Telecom Holding S.A.E.',                   nameAr: 'إيرثلينك للاتصالات القابضة',                sector: 'Telecommunications', industry: 'Mobile Telecoms',     fallbackPrice: 3.40  },

  // ─── Industrial (31) ──────────────────────────────────────────────────────
  { ticker: 'SWDY',  nameEn: 'El Sewedy Electric Company',                       nameAr: 'السويدي إليكتريك',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 88.47  },
  { ticker: 'EAST',  nameEn: 'Eastern Company',                          nameAr: 'الشركة الشرقية للدخان',                 sector: 'Industrial', industry: 'Tobacco',                    fallbackPrice: 36.47  },
  { ticker: 'ORAS',  nameEn: 'Orascom Construction Plc',                     nameAr: 'أوراسكوم للإنشاء والصناعة',             sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 682.01 },
  { ticker: 'MOIL',  nameEn: 'Maridive & Oil Services SAE',                  nameAr: 'ماريديف والنفط للخدمات',                sector: 'Industrial', industry: 'Oil Services',               fallbackPrice: 0.55   },
  { ticker: 'EGAL',  nameEn: 'Egypt Aluminum',                           nameAr: 'مصر للألومنيوم',                        sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 291.40 },
  { ticker: 'ALUM',  nameEn: 'Arab Aluminum Co. SAE',                            nameAr: 'العربية للألومنيوم',                    sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 22.81  },
  { ticker: 'MPRC',  nameEn: 'Egyptian Media Production City',           nameAr: 'مدينة الإنتاج الإعلامي',               sector: 'Industrial', industry: 'Media & Entertainment',      fallbackPrice: 42.16  },
  { ticker: 'ENGC',  nameEn: 'Industrial Engineering Co. for Construction & Development', nameAr: 'الصناعات الهندسية إيديال',          sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 41.54  },
  { ticker: 'ASCM',  nameEn: 'ASEC Co. for Mining',                  nameAr: 'أسيك للتعدين أسكوم',                    sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 62.12  },
  { ticker: 'COSG',  nameEn: 'Cairo Oils & Soap',                        nameAr: 'القاهرة للزيوت والصابون',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 1.67   },
  { ticker: 'EEII',  nameEn: 'El Arabia Engineering Industries',         nameAr: 'العربية للصناعات الهندسية',             sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 2.78   },
  { ticker: 'ACFR',  nameEn: 'Alexandria Company For Refractories',      nameAr: 'الإسكندرية للحراريات',                  sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'ANCC',  nameEn: 'ALNAHDA Industrial Co.',                   nameAr: 'النهضة للصناعات الوطنية',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  // ARVA (Arab Valves) removed — absent from TradingView scanner, no live data available.
  { ticker: 'AMII',  nameEn: 'Arabian Metal Industries & Industrial Investments', nameAr: 'العربية للصناعات المعدنية والاستثمارات الصناعية', sector: 'Industrial', industry: 'Metals & Mining', fallbackPrice: 16.00 },
  { ticker: 'ATQA',  nameEn: 'Misr National Steel',                      nameAr: 'مصر الوطنية للصلب',                     sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 9.59   },
  { ticker: 'DTPP',  nameEn: 'Delta for Printing & Packaging',           nameAr: 'دلتا للطباعة والتغليف',                 sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 207.52 },
  { ticker: 'ELEC',  nameEn: 'Electro Cable Egypt',                      nameAr: 'إليكترو كابل مصر',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 2.16   },
  { ticker: 'EPPK',  nameEn: 'El Ahram Co. for Printing & Packing',          nameAr: 'الأهرام للطباعة والتغليف',              sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 14.08  },
  { ticker: 'IRON',  nameEn: 'Egyptian Iron & Steel',                    nameAr: 'الحديد والصلب المصرية',                 sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 32.04  },
  { ticker: 'IRAX',  nameEn: 'El Ezz Aldekhela Steel-Alexandria',        nameAr: 'عز الدخيلة للصلب الإسكندرية',           sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 1245.00},
  { ticker: 'ISMQ',  nameEn: 'Iron & Steel for Mines & Quarries',        nameAr: 'الحديد والصلب للمناجم والمحاجر',        sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 9.55   },
  { ticker: 'MBEG',  nameEn: 'MB for Engineering & Contracting',         nameAr: 'إم بي للمقاولات والهندسة',              sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 4.16   },
  { ticker: 'MISR',  nameEn: 'MISR Intercontinental for Granite & Marble', nameAr: 'مصر إنتركونتيننتال للجرانيت والرخام', sector: 'Industrial', industry: 'Diversified Industrials',   fallbackPrice: 5.78   },
  { ticker: 'NCCW',  nameEn: 'Nasr Co. for Civil Works',                 nameAr: 'النصر للأعمال المدنية',                 sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 6.63   },
  { ticker: 'NMIN',  nameEn: 'El Nasr Mining Co Egp10',                           nameAr: 'النصر للتعدين',                         sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 10.00  },
  { ticker: 'RAKT',  nameEn: 'Rakta Paper Manufacturing',                nameAr: 'راكتا للورق',                           sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 23.00  },
  { ticker: 'UNIP',  nameEn: 'Universal Co. for Paper & Packaging Materials-Unipack',           nameAr: 'الوحدة للأوراق والكرتون',               sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 0.34   },
  { ticker: 'SMPP',  nameEn: 'Modern Shorouk Printing & Packaging',      nameAr: 'الشروق الحديثة للطباعة والتغليف',       sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 115.00 },
  { ticker: 'SINA',  nameEn: 'Sinai Manganese Company',                  nameAr: 'شركة سيناء للمنجنيز',                   sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 15.00  },
  { ticker: 'IEEC',  nameEn: 'Industrial & Engineering Enterprises Co.',     nameAr: 'المؤسسات الصناعية والهندسية',           sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.59   },
  { ticker: 'CFGH',  nameEn: 'Concrete Fashion Group for Commercial and Industrial Investments S.A.E',                   nameAr: 'كونكريت فاشون للاستثمارات التجارية والصناعية',       sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.11   },
  { ticker: 'MTIE',  nameEn: 'MM Group for Industry & International Trade', nameAr: 'مجموعة إم إم للصناعة والتجارة الدولية', sector: 'Industrial', industry: 'Diversified Industrials', fallbackPrice: 9.73   },
  { ticker: 'FNAR',  nameEn: 'Al Fanar Contracting Construction Trade Import & Export Co.',      nameAr: 'الفنار للمقاولات والإنشاءات',           sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 12.26  },
  { ticker: 'GDWA',  nameEn: 'Gadwa For Industrial Development',         nameAr: 'جدوى للتنمية الصناعية',                 sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.84   },
  { ticker: 'GMCI',  nameEn: 'GMC Group for Industrial Commercial & Financial Investments',    nameAr: 'مجموعة جي إم سي للصناعة والتجارة',      sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 2.00   },
  { ticker: 'YAYT',  nameEn: 'Spring & Transportation Needs Manufacturing Co.', nameAr: 'الينابيع لصناعة مستلزمات النقل',    sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'EFAC',  nameEn: 'Egyptian Ferro All Egp10',                    nameAr: 'المصرية لسبائك الحديد',              sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 10.00  },
  { ticker: 'DCRC',  nameEn: 'Delta Construction & Rebuilding Co.',          nameAr: 'دلتا للإنشاء وإعادة البناء',            sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 50.00  },

  // ─── Chemicals & Fertilizers (12) ─────────────────────────────────────────
  { ticker: 'ABUK',  nameEn: 'Abou Kir Fertilizers & Chemical Industries Co.', nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 69.05  },
  { ticker: 'SKPC',  nameEn: 'Sidi Kerir Petrochemicals',               nameAr: 'سيدي كرير للبتروكيماويات',               sector: 'Chemicals & Fertilizers', industry: 'Petrochemicals',   fallbackPrice: 16.40  },
  { ticker: 'MFPC',  nameEn: 'Misr Fertilizers Production Company MOPCO',     nameAr: 'موبكو لإنتاج الأسمدة',                   sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 37.10  },
  { ticker: 'EGCH',  nameEn: 'Egyptian Chemical Industries',     nameAr: 'الصناعات الكيماوية المصرية كيما',        sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 13.13  },
  { ticker: 'PACH',  nameEn: 'Paints & Chemical Industries Co.',                nameAr: 'باتشين للدهانات المصرية',                 sector: 'Chemicals & Fertilizers', industry: 'Paints & Coatings', fallbackPrice: 80.00 },
  { ticker: 'MICH',  nameEn: 'Misr Chemical Industries Ltd.',               nameAr: 'مصر للصناعات الكيماوية',                 sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 38.00  },
  { ticker: 'SMFR',  nameEn: 'Samad Misr-EGYFERT',                   nameAr: 'صامد مصر للأسمدة',                       sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 206.33 },
  { ticker: 'KZPC',  nameEn: 'Kafr El Zayat Pesticides & Chemical Co.',    nameAr: 'كفر الزيات للمبيدات والمواد الكيماوية',  sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 8.64   },
  { ticker: 'NFCI',  nameEn: 'ELNASR Co For Fertilizers And Chemical Industries',  nameAr: 'النصر للأسمدة والصناعات الكيماوية',      sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 10.00  },
  { ticker: 'ELAB',  nameEn: 'The Egyptian Linear Alkyl Benzene co.-ELAB',   nameAr: 'المصرية للألكيل بنزين الخطي',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 0.10   },
  { ticker: 'CID',   nameEn: 'Chemical Dev Ind Egp10',      nameAr: 'الكيماويات والتنمية الصناعية',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 10.00  },
  { ticker: 'MOSC',  nameEn: 'Misr Oils & Soap Co.',                       nameAr: 'مصر للزيوت والصابون',                    sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 297.11 },

  // ─── Energy (8) ───────────────────────────────────────────────────────────
  { ticker: 'AMOC',  nameEn: 'Alexandria Mineral Oils Co.',         nameAr: 'الإسكندرية لزيوت المعادن',             sector: 'Energy', industry: 'Oil Refining',         fallbackPrice: 8.05   },
  { ticker: 'INEG',  nameEn: 'Integrated Engineering Group S.A.E',            nameAr: 'المجموعة الهندسية المتكاملة',            sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.45   },
  { ticker: 'NDRL',  nameEn: 'National Drilling Co.',               nameAr: 'الشركة القومية للحفر',                   sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 4.69   },
  { ticker: 'PMSC',  nameEn: 'Petroleum Marine Services Co .P.M.S',               nameAr: 'خدمات النفط البحرية',                    sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 10.00  },
  { ticker: 'TAQA',  nameEn: 'TAQA Arabia',                             nameAr: 'طاقة العربية',                           sector: 'Energy', industry: 'Diversified Energy',   fallbackPrice: 14.87  },
  { ticker: 'EGAS',  nameEn: 'Egypt Gas Co.',                           nameAr: 'مصر للغاز',                             sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 53.47  },
  { ticker: 'ENPI',  nameEn: 'Engineering for the Petroleum and Process Industries-Enppi',        nameAr: 'الهندسة البترولية إنبي',                 sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.13   },
  { ticker: 'GSSC',  nameEn: 'General Silos & Storage Co.',                 nameAr: 'الشركة العامة للصوامع والتخزين',         sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 261.44 },

  // ─── Construction Materials (17) ──────────────────────────────────────────
  { ticker: 'SUCE',  nameEn: 'Suez Cement Co.',                             nameAr: 'أسمنت السويس',                          sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.00  },
  { ticker: 'MCQE',  nameEn: 'Misr Cement Co. (Qena)',                      nameAr: 'أسمنت مصر قنا',                         sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 177.00 },
  { ticker: 'LCSW',  nameEn: 'Lecico Egypt SAE',                            nameAr: 'ليسيكو مصر للسيراميك',                  sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 31.41  },
  { ticker: 'CERA',  nameEn: 'Arab Ceramic Co. - Ceramica Remas',       nameAr: 'العربية للسيراميك سيراميكا ريماس',       sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 1.32   },
  { ticker: 'SCEM',  nameEn: 'Sinai Cement Co.',                            nameAr: 'أسمنت سيناء',                           sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 62.32  },
  { ticker: 'SVCE',  nameEn: 'South Valley Cement Co.',                     nameAr: 'أسمنت وادي النيل',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 9.40   },
  { ticker: 'ARCC',  nameEn: 'Arabian Cement Company',                  nameAr: 'الأسمنت العربي',                        sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 55.17  },
  { ticker: 'ALEX',  nameEn: 'Alexandria Cement Co.',                       nameAr: 'أسمنت الإسكندرية',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.30  },
  { ticker: 'MBSC',  nameEn: 'Misr Beni Suef Cement Co. SAE',                   nameAr: 'مصر بني سويف للأسمنت',                  sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 240.04 },
  { ticker: 'TORA',  nameEn: 'Tourah Cement Co',                           nameAr: 'أسمنت طرة',                             sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 68.20  },
  { ticker: 'ECAP',  nameEn: 'El Ezz Ceramics & Porcelain Co. (Gemma)',     nameAr: 'عز للسيراميك والبورسلين جيما',          sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 32.68  },
  { ticker: 'MEGM',  nameEn: 'Middle East Glass Manufacturing SAE',         nameAr: 'الشرق الأوسط لصناعة الزجاج',           sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 12.54  },
  { ticker: 'PRCL',  nameEn: 'General Co. for Ceramic & Porcelain Products',    nameAr: 'الشركة العامة للسيراميك والبورسلين',     sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 34.90  },
  { ticker: 'RUBX',  nameEn: 'Rubex International for Plastic & Acrylic Manufacturing', nameAr: 'روبكس الدولية للبلاستيك والأكريليك', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 13.20  },
  { ticker: 'WATP',  nameEn: 'Modern Co. for Water Proofing',           nameAr: 'الحديثة للعزل المائي والحراري',         sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 24.00  },
  { ticker: 'SIEG',  nameEn: 'Egyptian Company for Pipes and Cement Products -Siegwart', nameAr: 'المصرية للأنابيب ومنتجات الأسمنت سيغوارت', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 10.00 },
  { ticker: 'KNGC',  nameEn: 'EL- Nasr Glass And Crystal',               nameAr: 'النصر للزجاج والبلور',                  sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 10.00  },

  // ─── Healthcare (19) ──────────────────────────────────────────────────────
  { ticker: 'CLHO',  nameEn: 'Cleopatra Hospital Company',                nameAr: 'مجموعة مستشفيات كليوباترا',             sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 16.07  },
  { ticker: 'PHAR',  nameEn: 'Egyptian International Pharmaceutical Industries Co.',                                  nameAr: 'الشركة المصرية الدولية للأدوية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 85.80  },
  { ticker: 'SPMD',  nameEn: 'Speed Medical SAE',                           nameAr: 'سبيد ميدكال للتشخيص',                   sector: 'Healthcare', industry: 'Diagnostics',         fallbackPrice: 0.45   },
  { ticker: 'RMDA',  nameEn: 'Tenth of Ramadan Pharmaceutical Industries & Diagnostic-Rameda',                   nameAr: 'راميدا للأدوية',                        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 4.97   },
  { ticker: 'ISPH',  nameEn: 'Ibnsina Pharma',                         nameAr: 'ابن سينا للأدوية والمستلزمات',          sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 11.47  },
  { ticker: 'ADCI',  nameEn: 'Arab Pharmaceuticals',                    nameAr: 'العربية للأدوية والصناعات الكيماوية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 236.44 },
  { ticker: 'AMES',  nameEn: 'Alexandria New Medical Center Co.',           nameAr: 'مجمع الإسكندرية الطبي الجديد',          sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 100.66  },
  { ticker: 'APPC',  nameEn: 'Advanced Pharmaceutical Packaging Co.',       nameAr: 'التعبئة الدوائية المتقدمة',             sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.34   },
  { ticker: 'AXPH',  nameEn: 'Alexandria Company for Pharmaceuticals and Chemical Industries',  nameAr: 'الإسكندرية للأدوية والصناعات الكيماوية',  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1205.55},
  { ticker: 'BIOC',  nameEn: 'GlaxoSmithKline S.A.E.',                   nameAr: 'جلاكسو سميث كلاين مصر',                sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 74.79  },
  { ticker: 'FCMD',  nameEn: 'Future Care For Medical Industries',      nameAr: 'المستقبل للصناعات الطبية',              sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 6.66   },
  { ticker: 'MCRO',  nameEn: 'Macro Group Pharmaceutical S.A.E.',              nameAr: 'ماكرو جروب للأدوية',                    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.35   },
  { ticker: 'MEPA',  nameEn: 'Medical Packaging Company',                   nameAr: 'التغليف الطبي',                         sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 1.66   },
  { ticker: 'MIPH',  nameEn: 'Minapharm Pharmaceuticals',               nameAr: 'منا فارم للصناعات الدوائية',            sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 707.19 },
  { ticker: 'MPCI',  nameEn: 'Memphis Pharmaceutical & Chemical Industries',       nameAr: 'ممفيس للصناعات الدوائية والكيماوية',    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 240.47 },
  { ticker: 'NIPH',  nameEn: 'El-Nile Co. for Pharmaceuticals & Chemical Industries',      nameAr: 'النيل للأدوية والصناعات الكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 176.21 },
  { ticker: 'OCPH',  nameEn: 'October Pharma Co.',                          nameAr: 'أكتوبر فارما للأدوية',                  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 366.34 },
  { ticker: 'SIPC',  nameEn: 'Sabaa International Company for Pharmaceutial and Chemical Industry',  nameAr: 'سبأ الدولية للصناعات الدوائية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 3.52   },
  { ticker: 'UPMS',  nameEn: 'Union Pharmacist Company For Medical Services And Investment',   nameAr: 'اتحاد الصيادلة للخدمات الطبية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 12.95  },
  { ticker: 'NINH',  nameEn: 'Nozha International Hospital',            nameAr: 'مستشفى النزهة الدولي',                  sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 17.99  },
  { ticker: 'CPCI',  nameEn: 'Kahira Pharmaceuticals & Chemical Industries Co.',       nameAr: 'القاهرة للصناعات الدوائية والكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 449.86 },

  // ─── Food & Beverage (28) ─────────────────────────────────────────────────
  { ticker: 'JUFO',  nameEn: 'Juhayna Food Industries',                 nameAr: 'جهينة للأغذية والألبان',                sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 30.50  },
  { ticker: 'DOMT',  nameEn: 'Arabian Food Industries Co.',          nameAr: 'الشركة العربية لصناعات الأغذية دومتي', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 27.04  },
  { ticker: 'EFID',  nameEn: 'Edita Food Industries SAE',                   nameAr: 'أديتا للصناعات الغذائية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 28.38  },
  { ticker: 'POUL',  nameEn: 'Cairo Poultry Co.',                     nameAr: 'القاهرة للدواجن',                       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 39.57  },
  { ticker: 'AJWA',  nameEn: 'Ajwa for Food Industries Co. Egypt',    nameAr: 'مجموعة أجواء للصناعات الغذائية',        sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 183.97 },
  { ticker: 'ISMA',  nameEn: 'Ismailia Misr Poultry',                  nameAr: 'الإسماعيلية مصر للدواجن',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 27.35  },
  { ticker: 'IFAP',  nameEn: 'International Agricultural Products',     nameAr: 'المنتجات الزراعية الدولية',             sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 19.67  },
  { ticker: 'OLFI',  nameEn: 'Obour Land for Food Industries',          nameAr: 'أرض العبور للصناعات الغذائية',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 22.99  },
  { ticker: 'INFI',  nameEn: 'Ismailia National Food Industries',       nameAr: 'الإسماعيلية الوطنية للصناعات الغذائية', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 103.64 },
  { ticker: 'SUGR',  nameEn: 'Delta Sugar',                             nameAr: 'دلتا للسكر',                            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 47.23  },
  { ticker: 'AFMC',  nameEn: 'Alexandria Flour Mills Co.',                  nameAr: 'مطاحن الإسكندرية',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 75.25  },
  { ticker: 'MILS',  nameEn: 'North Cairo Mills Co.',                       nameAr: 'مطاحن شمال القاهرة',                    sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 137.71 },
  { ticker: 'SCFM',  nameEn: 'South Cairo & Giza Mills & Bakeries',                nameAr: 'مطاحن جنوب القاهرة والجيزة',           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 256.05 },
  { ticker: 'WCDF',  nameEn: 'Middle & West Delta Flour Mills Co.',         nameAr: 'مطاحن وسط وغرب الدلتا',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 525.00 },
  { ticker: 'UEFM',  nameEn: 'Upper Egypt Flour Mills Co.',                 nameAr: 'مطاحن الصعيد',                          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 500.00 },
  { ticker: 'EDFM',  nameEn: 'East Delta Flour Mills Co.',                  nameAr: 'مطاحن شرق الدلتا',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 354.39 },
  { ticker: 'CEFM',  nameEn: 'Middle Egypt Flour Mills',                nameAr: 'مطاحن وسط مصر',                         sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 104.98 },
  { ticker: 'SNFC',  nameEn: 'Sharkia National Food',                   nameAr: 'الشركية الوطنية للأغذية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.80  },
  { ticker: 'SNFI',  nameEn: 'Souhag National Food Industries',         nameAr: 'سوهاج الوطنية للصناعات الغذائية',       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 10.53  },
  { ticker: 'EPCO',  nameEn: 'Egypt for Poultry Co.',                   nameAr: 'مصر للدواجن',                           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 9.70   },
  { ticker: 'MPCO',  nameEn: 'Mansourah Poultry Co.',                       nameAr: 'المنصورة للدواجن',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 1.89   },
  { ticker: 'GOUR',  nameEn: 'Gourmet Egypt.Com Foods',                     nameAr: 'جورميه مصر للأغذية',                   sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 14.25  },
  { ticker: 'ZEOT',  nameEn: 'Extracted Oils & Derivatives Co.',            nameAr: 'الزيوت المستخلصة ومشتقاتها',            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.71  },
  { ticker: 'ADPC',  nameEn: 'Arab Dairy Products Co. Arab Dairy - Panda',              nameAr: 'منتجات الألبان العربية بانده',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 3.76   },
  { ticker: 'AIFI',  nameEn: 'Atlas for Investment & Food Industries SAE',  nameAr: 'أطلس للاستثمار والصناعات الغذائية',     sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 2.13   },
  { ticker: 'ELNA',  nameEn: 'El Nasr for Manufacturing Agricultural Crops', nameAr: 'النصر لتصنيع المحاصيل الزراعية',  sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 39.47  },
  { ticker: 'MFSC',  nameEn: 'Misr Duty Free Shops Co.',                    nameAr: 'مصر للمحلات الحرة',                     sector: 'Food & Beverage', industry: 'Retail',            fallbackPrice: 45.71  },
  { ticker: 'KABO',  nameEn: 'El Nasr Clothing & Textiles Co.',             nameAr: 'النصر للملابس والمنسوجات',              sector: 'Textile',         industry: 'Apparel',           fallbackPrice: 7.51   },

  // ─── Technology (10) ──────────────────────────────────────────────────────
  { ticker: 'FWRY',  nameEn: 'Fawry For Banking Technology And Electronic Payment', nameAr: 'فوري للبنوك والمدفوعات الإلكترونية', sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 19.30 },
  { ticker: 'EFIH',  nameEn: 'e-finance for Digital and Financial Investments S.A.E.',     nameAr: 'إي فاينانس للاستثمارات الرقمية والمالية',      sector: 'Technology', industry: 'Digital Finance',     fallbackPrice: 22.45 },
  { ticker: 'VERT',  nameEn: 'Vertika for Industry & Trade',            nameAr: 'فيرتيكا للصناعة والتجارة',              sector: 'Technology', industry: 'Technology Services', fallbackPrice: 7.93   },
  { ticker: 'RACC',  nameEn: 'Raya Contact Center',                     nameAr: 'رايا لخدمات مراكز الاتصال',             sector: 'Technology', industry: 'Technology Services', fallbackPrice: 10.48  },
  { ticker: 'AMPI',  nameEn: 'AL Moasher Pay for Electronic Payment and Collection (S.A.E)',   nameAr: 'المؤشر باي للمدفوعات الإلكترونية',      sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 2.80   },
  { ticker: 'DGTZ',  nameEn: 'Digitize for Investment And Technology',    nameAr: 'ديجيتايز للاستثمار والتكنولوجيا',       sector: 'Technology', industry: 'Technology Services', fallbackPrice: 2.63   },
  { ticker: 'EGSA',  nameEn: 'Egyptian Satellite Co.',                  nameAr: 'الشركة المصرية للقمر الصناعي',          sector: 'Technology', industry: 'Satellite & Telecom', fallbackPrice: 8.95   },
  { ticker: 'SCTS',  nameEn: 'Sues Canal Co. for Technology Settling',  nameAr: 'قناة السويس للتكنولوجيا والتسويات',     sector: 'Technology', industry: 'Technology Services', fallbackPrice: 616.15 },
  { ticker: 'FTNS',  nameEn: 'Fitness Prime',                           nameAr: 'فيتنس برايم',                           sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.21   },
  { ticker: 'GEOS',  nameEn: 'Geos for trading and contracting',        nameAr: 'جيوس للتجارة والمقاولات',               sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.00   },

  // ─── Textile (9) ──────────────────────────────────────────────────────────
  { ticker: 'ORWE',  nameEn: 'Oriental Weavers Carpet',                 nameAr: 'الشرقية للسجاد',                        sector: 'Textile', industry: 'Carpets & Flooring',     fallbackPrice: 22.65  },
  { ticker: 'DSCW',  nameEn: 'Dice Sports & Casual Wear Manufacturers SAE',  nameAr: 'دايس للملابس الرياضية',                 sector: 'Textile', industry: 'Apparel',                fallbackPrice: 1.85   },
  { ticker: 'ACGC',  nameEn: 'Arab Cotton Ginning Co.',                     nameAr: 'العربية لحلج الأقطان',                  sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 10.01   },
  { ticker: 'APSW',  nameEn: 'Arab Polvara Spinning & Weaving Co.',         nameAr: 'العربية بولفارة للغزل والنسيج',         sector: 'Textile', industry: 'Textiles',               fallbackPrice: 8.51   },
  { ticker: 'GTWL',  nameEn: 'Golden Textiles & Clothes Wool',          nameAr: 'الذهبية للمنسوجات والملابس والصوف',     sector: 'Textile', industry: 'Textiles',               fallbackPrice: 112.99 },
  { ticker: 'NCGC',  nameEn: 'Nile Cotton Ginning',                     nameAr: 'النيل لحلج الأقطان',                    sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 51.00  },
  { ticker: 'SPIN',  nameEn: 'Alexandria Spinning & Weaving',           nameAr: 'الإسكندرية للغزل والنسيج',              sector: 'Textile', industry: 'Textiles',               fallbackPrice: 14.63  },
  { ticker: 'GTEX',  nameEn: 'G-TEX for Commercial and Industrial Investments S.A.E',     nameAr: 'جي تكس للاستثمارات التجارية والصناعية', sector: 'Textile', industry: 'Textiles',               fallbackPrice: 0.03   },

  // ─── Agriculture (7) ──────────────────────────────────────────────────────
  { ticker: 'AALR',  nameEn: 'General Co. for Land Reclamation Development & Reconstruction',        nameAr: 'الشركة العامة لاستصلاح الأراضي',        sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 230.05 },
  { ticker: 'EALR',  nameEn: 'El Arabia for Land Reclamation',          nameAr: 'العربية لاستصلاح الأراضي',              sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 369.95 },
  { ticker: 'GGRN',  nameEn: 'Gogreen for Agricultural Investment and Development Company',         nameAr: 'جو جرين للاستثمار والتنمية الزراعية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 1.45   },
  { ticker: 'KRDI',  nameEn: 'Al Khair River for Development Agriculture Investment and Environmental Services', nameAr: 'الخير للتنمية الزراعية والبيئية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.35   },
  { ticker: 'LUTS',  nameEn: 'Lotus For Agricultural Investments And Development',          nameAr: 'لوتس للاستثمارات الزراعية',             sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.74   },
  { ticker: 'NEDA',  nameEn: 'Northern Upper Egypt Development & Agricultural Production', nameAr: 'شمال الصعيد للتنمية والإنتاج الزراعي', sector: 'Agriculture', industry: 'Agriculture', fallbackPrice: 2.79   },
  { ticker: 'WKOL',  nameEn: 'Wadi Kom Ombo Land Reclamation',          nameAr: 'وادي كوم أمبو لاستصلاح الأراضي',       sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 315.00 },

  // ─── Missing from earlier — confirmed in TradingView scanner ─────────────
  { ticker: 'SAUD',  nameEn: 'Al Baraka Bank Egypt',                    nameAr: 'بنك البركة مصر',                        sector: 'Banking',            industry: 'Islamic Banking',       fallbackPrice: 21.54  },
  { ticker: 'ARAB',  nameEn: 'Arab Developers Holding',                 nameAr: 'العرب للتطوير العقاري القابضة',          sector: 'Real Estate',        industry: 'Real Estate Development', fallbackPrice: 0.25   },
  { ticker: 'DAPH',  nameEn: 'Development & Engineering Consultants',   nameAr: 'التنمية والاستشارات الهندسية',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 84.00  },
  { ticker: 'HBCO',  nameEn: 'Heibco Npv',                                  nameAr: 'هيبكو',                                 sector: 'Industrial',         industry: 'Diversified Industrials', fallbackPrice: 13.40  },

  // ─── Insurance (3) ────────────────────────────────────────────────────────
  { ticker: 'DEIN',  nameEn: 'Delta Insurance',                         nameAr: 'دلتا للتأمين',                          sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 10.35  },
  { ticker: 'MOIN',  nameEn: 'Mohandes Insurance Co.',                      nameAr: 'المهندس للتأمين',                       sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 23.98  },
  { ticker: 'MLIC',  nameEn: 'Misr Life Insurance',                     nameAr: 'مصر للتأمين على الحياة',                sector: 'Insurance', industry: 'Life Insurance',       fallbackPrice: 10.00  },

  // ─── Education (4) ────────────────────────────────────────────────────────
  { ticker: 'CIRA',  nameEn: 'Cairo For Investment And Real Estate Developments -CIRA Education',                          nameAr: 'سيرا للتعليم',                          sector: 'Education', industry: 'Education Services',   fallbackPrice: 31.37  },
  { ticker: 'CAED',  nameEn: 'Cairo Educational Services',              nameAr: 'القاهرة للخدمات التعليمية',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 74.42  },
  { ticker: 'EEP',   nameEn: 'Egypt Education Platform - EEP',                nameAr: 'المنصة المصرية للتعليم',                sector: 'Education', industry: 'Education Services',   fallbackPrice: 1.00   },
  { ticker: 'TALM',  nameEn: 'Taaleem Management Services S.A.E',             nameAr: 'تعليم لإدارة الخدمات',                  sector: 'Education', industry: 'Education Services',   fallbackPrice: 15.72  },
  { ticker: 'MOED',  nameEn: 'Egyptian Modern Education Systems',       nameAr: 'الأنظمة التعليمية الحديثة',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 0.73   },

  // ─── Transportation (7) ───────────────────────────────────────────────────
  { ticker: 'ALCN',  nameEn: 'Alexandria Containers & Goods',   nameAr: 'الإسكندرية للحاويات والشحن',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 29.91  },
  { ticker: 'ETRS',  nameEn: 'Egyptian Transport And Commercial Services Co. (Egytrans Nosco)',            nameAr: 'مصر للنقل إيجيترانس',                   sector: 'Transportation', industry: 'Road Transport',   fallbackPrice: 10.79  },
  { ticker: 'CSAG',  nameEn: 'Canal Shipping Agencies Co.',                 nameAr: 'وكلاء الشحن بالقنال',                   sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 32.35  },
  { ticker: 'DCCC',  nameEn: 'Damietta Container and Cargo Handling',     nameAr: 'دمياط للحاويات والبضائع',               sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 10.00  },
  { ticker: 'POCO',  nameEn: 'Port Said Container And Cargo Handling',    nameAr: 'بور سعيد للحاويات والبضائع',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 5.00   },
  { ticker: 'EGWA',  nameEn: 'General Warehouses of Egypt',             nameAr: 'المخازن العمومية المصرية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 5.00   },
  { ticker: 'BIDI',  nameEn: 'El Badr Investment and Development - BID',      nameAr: 'البدر للاستثمار والتنمية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 1.76   },

];

// ─── EGX Index Membership ─────────────────────────────────────────────────────

export type EGXIndex = 'All' | 'EGX 30' | 'EGX 70';
export const EGX_INDICES: EGXIndex[] = ['All', 'EGX 30', 'EGX 70'];

// EGX 30 — blue-chip large-cap index (29 stocks after removing ESRS which has no live data)
export const EGX_30_TICKERS = new Set<string>([
  'COMI', 'CIEB', 'ADIB', 'HDBK', 'QNBE',  // Banking
  'HRHO', 'EFIH',                             // Financial Services
  'TMGH', 'PHDC', 'MASR', 'OCDI', 'EMFD', 'ORHD', 'HELI',  // Real Estate
  'ETEL',                                     // Telecoms
  'SWDY', 'EAST', 'ORAS',                    // Industrial (ESRS removed — no live data)
  'ABUK', 'SKPC',                             // Chemicals
  'AMOC',                                     // Energy
  'LCSW',                                     // Construction
  'CLHO', 'SPMD',                             // Healthcare
  'JUFO', 'EFID',                             // Food & Beverage
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

// Extract Cairo time parts directly — avoids the toLocaleString→new Date() round-trip
// which re-parses the string in the *device's* local timezone and gives wrong hours
// on any device not set to Cairo time.
function getCairoTimeParts(now: Date = new Date()): { day: number; h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  // hour12:false can return '24' for midnight on some platforms — normalise
  const rawH = parseInt(get('hour'));
  return {
    day: dayMap[get('weekday')] ?? 1,
    h: rawH === 24 ? 0 : rawH,
    m: parseInt(get('minute')),
  };
}

export function getEGXMarketStatus(): EGXMarketStatus {
  const { day, h, m } = getCairoTimeParts();
  const mins = h * 60 + m;

  const PRE_OPEN   = 9  * 60 + 30; // 09:30
  const OPEN       = 10 * 60;      // 10:00
  const CLOSE      = 14 * 60 + 30; // 14:30
  const POST_CLOSE = 15 * 60;      // 15:00

  const isWeekday = day >= 0 && day <= 4; // Sun(0)–Thu(4)

  if (!isWeekday) {
    return { session: 'closed', label: 'Closed', nextEvent: 'Opens Sunday 10:00' };
  }
  if (mins < PRE_OPEN) {
    return { session: 'closed', label: 'Closed', nextEvent: 'Pre-session at 09:30' };
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
