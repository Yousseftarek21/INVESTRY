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
  yahoo: string;
  nameEn: string;
  nameAr: string;
  sector: Exclude<EGXSector, 'All'>;
  industry: string;
  fallbackPrice: number;
}

export const EGX_COMPANIES: EGXCompany[] = [

  // ─── Banking (13) ─────────────────────────────────────────────────────────
  { ticker: 'COMI',  yahoo: 'COMI.CA',  nameEn: 'Commercial International Bank (CIB)',     nameAr: 'البنك التجاري الدولي',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 134.52 },
  { ticker: 'CIEB',  yahoo: 'CIEB.CA',  nameEn: 'Credit Agricole Egypt',                   nameAr: 'كريدي أجريكول مصر',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 24.24  },
  { ticker: 'ADIB',  yahoo: 'ADIB.CA',  nameEn: 'Abu Dhabi Islamic Bank Egypt',             nameAr: 'بنك أبو ظبي الإسلامي مصر',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 46.95  },
  { ticker: 'HDBK',  yahoo: 'HDBK.CA',  nameEn: 'Housing & Development Bank',              nameAr: 'بنك التعمير والإسكان',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 78.50  },
  { ticker: 'QNBE',  yahoo: 'QNBE.CA',  nameEn: 'QNB Alahli',                              nameAr: 'بنك قطر الأهلي',                         sector: 'Banking', industry: 'Banks',          fallbackPrice: 54.60  },
  { ticker: 'NBKE',  yahoo: 'NBKE.CA',  nameEn: 'National Bank of Kuwait Egypt',           nameAr: 'بنك الكويت الوطني مصر',                  sector: 'Banking', industry: 'Banks',          fallbackPrice: 33.00  },
  { ticker: 'CANA',  yahoo: 'CANA.CA',  nameEn: 'Suez Canal Bank',                         nameAr: 'بنك قناة السويس',                        sector: 'Banking', industry: 'Banks',          fallbackPrice: 36.53  },
  { ticker: 'SAIB',  yahoo: 'SAIB.CA',  nameEn: 'Societe Arabe Internationale de Banque', nameAr: 'الشركة العربية الدولية للبنوك',           sector: 'Banking', industry: 'Banks',          fallbackPrice: 2.11   },
  { ticker: 'UBEE',  yahoo: 'UBEE.CA',  nameEn: 'United Bank',                             nameAr: 'البنك المتحد',                           sector: 'Banking', industry: 'Banks',          fallbackPrice: 13.33  },
  { ticker: 'EXPA',  yahoo: 'EXPA.CA',  nameEn: 'Export Development Bank of Egypt',        nameAr: 'بنك تنمية الصادرات',                     sector: 'Banking', industry: 'Banks',          fallbackPrice: 18.74  },
  { ticker: 'EGBE',  yahoo: 'EGBE.CA',  nameEn: 'Egyptian Gulf Bank',                      nameAr: 'بنك الخليج المصري',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 0.45   },
  { ticker: 'FAIT',  yahoo: 'FAIT.CA',  nameEn: 'Faisal Islamic Bank of Egypt',            nameAr: 'بنك فيصل الإسلامي المصري',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 37.02  },
  { ticker: 'FAITA', yahoo: 'FAITA.CA', nameEn: 'Faisal Islamic Bank of Egypt (B Shares)', nameAr: 'بنك فيصل الإسلامي المصري (أسهم ب)',      sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 0.98   },

  // ─── Financial Services (40) ──────────────────────────────────────────────
  { ticker: 'HRHO',  yahoo: 'HRHO.CA',  nameEn: 'EFG Holding',                             nameAr: 'هيرميس للأوراق المالية',                 sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 26.52  },
  { ticker: 'CICH',  yahoo: 'CICH.CA',  nameEn: 'CI Capital Holding',                      nameAr: 'سي آي كابيتال القابضة',                  sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 11.62  },
  { ticker: 'EFIC',  yahoo: 'EFIC.CA',  nameEn: 'Egyptian Financial & Industrial Co.',     nameAr: 'المصرية المالية والصناعية',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 183.00 },
  { ticker: 'GBCO',  yahoo: 'GBCO.CA',  nameEn: 'GB Corp',                                 nameAr: 'جي بي كوربوريشن',                        sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 31.10  },
  { ticker: 'CCAP',  yahoo: 'CCAP.CA',  nameEn: 'QALA For Financial Investments',          nameAr: 'قلعة للاستثمارات المالية',                sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 5.25   },
  { ticker: 'BINV',  yahoo: 'BINV.CA',  nameEn: 'B Investments Holding',                   nameAr: 'بي إنفستمنتس القابضة',                   sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 48.40  },
  { ticker: 'BTFH',  yahoo: 'BTFH.CA',  nameEn: 'Beltone Holding',                         nameAr: 'بلتون القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 3.07   },
  { ticker: 'CNFN',  yahoo: 'CNFN.CA',  nameEn: 'Contact Financial Holding',               nameAr: 'كونتاكت للاستثمار المالي',               sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 4.83   },
  { ticker: 'ACTF',  yahoo: 'ACTF.CA',  nameEn: 'Act Financial',                           nameAr: 'أكت للاستثمارات المالية',                sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 2.79   },
  { ticker: 'ASPI',  yahoo: 'ASPI.CA',  nameEn: 'Aspire Capital Holding',                  nameAr: 'أسباير كابيتال للاستثمارات المالية',     sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.32   },
  { ticker: 'ATLC',  yahoo: 'ATLC.CA',  nameEn: 'Al Tawfeek Leasing',                      nameAr: 'التوفيق للتأجير التمويلي',               sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 5.22   },
  { ticker: 'VALU',  yahoo: 'VALU.CA',  nameEn: 'U Consumer Finance',                      nameAr: 'يو للتمويل الاستهلاكي',                  sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 12.73  },
  { ticker: 'RAYA',  yahoo: 'RAYA.CA',  nameEn: 'Raya Holding for Financial Investments',  nameAr: 'رايا القابضة للاستثمارات المالية',        sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.26   },
  { ticker: 'ICLE',  yahoo: 'ICLE.CA',  nameEn: 'International Co. for Leasing',           nameAr: 'الشركة الدولية للتأجير التمويلي',        sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 15.76  },
  { ticker: 'ICFC',  yahoo: 'ICFC.CA',  nameEn: 'International Co. for Fertilizers & Chemicals', nameAr: 'الشركة الدولية للأسمدة والكيماويات', sector: 'Financial Services', industry: 'Diversified Financials', fallbackPrice: 15.02 },
  { ticker: 'MKIT',  yahoo: 'MKIT.CA',  nameEn: 'Misr Kuwait Investment & Trading',        nameAr: 'مصر الكويت للاستثمار والتجارة',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.76   },
  { ticker: 'KWIN',  yahoo: 'KWIN.CA',  nameEn: 'El Kahera El Watania Investment',          nameAr: 'القاهرة الوطنية للاستثمار',              sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 68.35  },
  { ticker: 'NAHO',  yahoo: 'NAHO.CA',  nameEn: 'Naeem Holding',                            nameAr: 'نعيم القابضة',                           sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.10   },
  { ticker: 'ODIN',  yahoo: 'ODIN.CA',  nameEn: 'ODIN Investments',                         nameAr: 'أودين للاستثمارات',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.35   },
  { ticker: 'OFH',   yahoo: 'OFH.CA',   nameEn: 'OB Financial Holding',                     nameAr: 'أو بي فاينانشيال القابضة',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.63   },
  { ticker: 'OIH',   yahoo: 'OIH.CA',   nameEn: 'Orascom Investment Holding',               nameAr: 'أوراسكوم للاستثمار القابضة',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 1.41   },
  { ticker: 'PRMH',  yahoo: 'PRMH.CA',  nameEn: 'Prime Holding',                            nameAr: 'برايم القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.77   },
  { ticker: 'RKAZ',  yahoo: 'RKAZ.CA',  nameEn: 'REKAZ Financial Holding',                  nameAr: 'ركاز للاستثمار المالي القابضة',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 4.97   },
  { ticker: 'TYCN',  yahoo: 'TYCN.CA',  nameEn: 'Tycoon Holding',                           nameAr: 'تيكون القابضة للاستثمارات المالية',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 21.22  },
  { ticker: 'TWSA',  yahoo: 'TWSA.CA',  nameEn: 'TAWASOA For Factoring',                    nameAr: 'تواصل للتخصيم',                          sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 6.83   },
  { ticker: 'GRCA',  yahoo: 'GRCA.CA',  nameEn: 'Grand Investment Capital',                 nameAr: 'جراند للاستثمار الرأسمالي',              sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 48.95  },
  { ticker: 'HAVC',  yahoo: 'HAVC.CA',  nameEn: 'Hassan Allam Investments & Venture Capital', nameAr: 'حسن علام للاستثمار ورأس المال المخاطر', sector: 'Financial Services', industry: 'Investment Banking',   fallbackPrice: 1.00   },
  { ticker: 'LKGP',  yahoo: 'LKGP.CA',  nameEn: 'Lakah Group Holding',                      nameAr: 'مجموعة لقا القابضة',                     sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.50   },
  { ticker: 'SEIG',  yahoo: 'SEIG.CA',  nameEn: 'Saudi Egyptian Investment & Finance',      nameAr: 'السعودية المصرية للاستثمار والتمويل',    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 258.03 },
  { ticker: 'SEIGA', yahoo: 'SEIGA.CA', nameEn: 'Saudi Egyptian Investment & Finance (A)',  nameAr: 'السعودية المصرية للاستثمار والتمويل (أ)', sector: 'Financial Services', industry: 'Investment Banking',     fallbackPrice: 0.95   },
  { ticker: 'VLMR',  yahoo: 'VLMR.CA',  nameEn: 'Valmore Holding',                          nameAr: 'فالمور القابضة',                         sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.66   },
  { ticker: 'VLMRA', yahoo: 'VLMRA.CA', nameEn: 'Valmore Holding (A)',                       nameAr: 'فالمور القابضة (أ)',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 28.95  },
  { ticker: 'OCAP',  yahoo: 'OCAP.CA',  nameEn: 'OG Capital For Investments',               nameAr: 'أو جي كابيتال للاستثمارات',             sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 1.00   },
  { ticker: 'EASB',  yahoo: 'EASB.CA',  nameEn: 'Egyptian Arabian Securities Brokerage',    nameAr: 'الشركة المصرية العربية للسمسرة',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 7.19   },
  { ticker: 'EBSC',  yahoo: 'EBSC.CA',  nameEn: 'Osool ESB Securities Brokerage',           nameAr: 'أصول للوساطة في الأوراق المالية',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.93   },
  { ticker: 'EOSB',  yahoo: 'EOSB.CA',  nameEn: 'El Orouba Securities Brokerage',           nameAr: 'العروبة للوساطة في الأوراق المالية',     sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.55   },
  { ticker: 'ACAMD', yahoo: 'ACAMD.CA', nameEn: 'Arab Co. for Asset Management & Development', nameAr: 'العربية لإدارة الأصول والتنمية',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.33   },
  { ticker: 'ACAP',  yahoo: 'ACAP.CA',  nameEn: 'A Capital Holding',                        nameAr: 'إيه كابيتال القابضة',                    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 8.80   },
  { ticker: 'HDST',  yahoo: 'HDST.CA',  nameEn: 'HEDGESTONE INVESTMENT',                    nameAr: 'هيدج ستون للاستثمار',                    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.10   },
  { ticker: 'AIDC',  yahoo: 'AIDC.CA',  nameEn: 'Arabia for Investment and Development',    nameAr: 'العربية للاستثمار والتنمية',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.71   },
  { ticker: 'AIH',   yahoo: 'AIH.CA',   nameEn: 'Arabia Investments Holding',               nameAr: 'العربية للاستثمارات القابضة',            sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.48   },
  { ticker: 'AMIA',  yahoo: 'AMIA.CA',  nameEn: 'Arab Moltaqa Investments',                 nameAr: 'الاستثمارات العربية المتقدمة',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.95   },
  { ticker: 'BIGP',  yahoo: 'BIGP.CA',  nameEn: 'ElBarbary Investment Group',               nameAr: 'مجموعة البربري للاستثمار',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.32   },
  { ticker: 'CPME',  yahoo: 'CPME.CA',  nameEn: 'Catalyst Partners Middle East',            nameAr: 'كاتاليست بارتنرز الشرق الأوسط',         sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 18.00  },
  { ticker: 'IBCT',  yahoo: 'IBCT.CA',  nameEn: 'International Business Corp. for Trading', nameAr: 'الشركة الدولية للأعمال والتجارة',       sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 13.33  },
  { ticker: 'KORA',  yahoo: 'KORA.CA',  nameEn: 'KORRA',                                    nameAr: 'كورة',                                   sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.40   },
  { ticker: 'MAAL',  yahoo: 'MAAL.CA',  nameEn: 'Marseilla El Masreia El Khalegeya Holding', nameAr: 'مرسيلا المصرية الخليجية للاستثمار',    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.13   },

  // ─── Real Estate (35) ─────────────────────────────────────────────────────
  { ticker: 'TMGH',  yahoo: 'TMGH.CA',  nameEn: 'Talaat Moustafa Group Holding',            nameAr: 'طلعت مصطفى للتشييد والبناء',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 96.50  },
  { ticker: 'PHDC',  yahoo: 'PHDC.CA',  nameEn: 'Palm Hills Development',                   nameAr: 'بالم هيلز للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 14.90  },
  { ticker: 'MASR',  yahoo: 'MASR.CA',  nameEn: 'Madinet Masr for Housing & Development',   nameAr: 'مدينة مصر للإسكان والتعمير',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 7.95   },
  { ticker: 'OCDI',  yahoo: 'OCDI.CA',  nameEn: 'SODIC',                                    nameAr: 'شركة أكتوبر للتنمية والاستثمار',        sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 26.95  },
  { ticker: 'EMFD',  yahoo: 'EMFD.CA',  nameEn: 'Emaar Misr for Development',               nameAr: 'إعمار مصر للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 11.75  },
  { ticker: 'ORHD',  yahoo: 'ORHD.CA',  nameEn: 'Orascom Development Egypt',               nameAr: 'أوراسكوم للتطوير مصر',                  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 39.21  },
  { ticker: 'HELI',  yahoo: 'HELI.CA',  nameEn: 'Heliopolis Housing',                        nameAr: 'مصر الجديدة للإسكان والتعمير',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.46   },
  { ticker: 'EGTS',  yahoo: 'EGTS.CA',  nameEn: 'Egyptian for Tourism Resorts',             nameAr: 'المجمعات السياحية المصرية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 18.35  },
  { ticker: 'AMER',  yahoo: 'AMER.CA',  nameEn: 'Amer Group Holding',                       nameAr: 'مجموعة عامر القابضة',                   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 3.16   },
  { ticker: 'UNIT',  yahoo: 'UNIT.CA',  nameEn: 'United Housing Construction',              nameAr: 'الاتحاد للإسكان والتعمير',              sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 19.51  },
  { ticker: 'ELSH',  yahoo: 'ELSH.CA',  nameEn: 'El Shams Housing & Development',           nameAr: 'الشمس للإسكان والتعمير',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 14.80  },
  { ticker: 'EHDR',  yahoo: 'EHDR.CA',  nameEn: 'Egyptians Housing Development & Reconstruction', nameAr: 'مصر للإسكان والتعمير',           sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 2.73   },
  { ticker: 'IDRE',  yahoo: 'IDRE.CA',  nameEn: 'Ismailia Development & Real Estate',       nameAr: 'الإسماعيلية الجديدة للتطوير العمراني', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 47.00  },
  { ticker: 'ZMID',  yahoo: 'ZMID.CA',  nameEn: 'Zahraa Maadi Investment & Development',   nameAr: 'زهراء المعادي للاستثمار والتعمير',      sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 7.05   },
  { ticker: 'RREI',  yahoo: 'RREI.CA',  nameEn: 'Arab Real Estate Investment Co.',          nameAr: 'الاتحاد العقاري المصري',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.81   },
  { ticker: 'MENA',  yahoo: 'MENA.CA',  nameEn: 'Mena Touristic & Real Estate Investment',  nameAr: 'مينا للاستثمار السياحي والعقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.10   },
  { ticker: 'RTVC',  yahoo: 'RTVC.CA',  nameEn: 'Remco for Touristic Villages Construction', nameAr: 'ريمكو للتجمعات السياحية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.84   },
  { ticker: 'AREH',  yahoo: 'AREH.CA',  nameEn: 'Egyptian Real Estate Group',               nameAr: 'المجموعة المصرية للعقارات',             sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.71   },
  { ticker: 'BONY',  yahoo: 'BONY.CA',  nameEn: 'Bonyan for Development and Trade',         nameAr: 'بنيان للتطوير والتجارة',                sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 4.85   },
  { ticker: 'CCRS',  yahoo: 'CCRS.CA',  nameEn: 'Gulf Canadian Real Estate Investment',     nameAr: 'الخليج الكندي للاستثمار العقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.38   },
  { ticker: 'CRST',  yahoo: 'CRST.CA',  nameEn: 'Creast Mark for Real Estate Development',  nameAr: 'كريست مارك للمقاولات والتطوير العقاري', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.50   },
  { ticker: 'EGREF', yahoo: 'EGREF.CA', nameEn: 'Egyptians Real Estate Fund',               nameAr: 'الصندوق المصري للعقارات',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 13.92  },
  { ticker: 'ELKA',  yahoo: 'ELKA.CA',  nameEn: 'El Kahera Housing',                        nameAr: 'القاهرة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.64   },
  { ticker: 'ELWA',  yahoo: 'ELWA.CA',  nameEn: 'Elwadi International Investment & Development', nameAr: 'الوادي للاستثمار الدولي',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.04   },
  { ticker: 'FIRE',  yahoo: 'FIRE.CA',  nameEn: 'First Investment & Real Estate Development', nameAr: 'الأولى للاستثمار والتطوير العقاري',   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.25   },
  { ticker: 'GIHD',  yahoo: 'GIHD.CA',  nameEn: 'Gharbia Islamic Housing Development',      nameAr: 'الغربية الإسلامية للإسكان والتعمير',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 50.22  },
  { ticker: 'GPIM',  yahoo: 'GPIM.CA',  nameEn: 'GPI For Urban Growth',                     nameAr: 'جي بي آي للنمو العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.10   },
  { ticker: 'GPPL',  yahoo: 'GPPL.CA',  nameEn: 'Golden Pyramids Plaza',                    nameAr: 'هضبة الأهرام بلازا',                    sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.40   },
  { ticker: 'ICID',  yahoo: 'ICID.CA',  nameEn: 'International Co. for Investment & Development', nameAr: 'الشركة الدولية للاستثمار والتنمية', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.29 },
  { ticker: 'MMHC',  yahoo: 'MMHC.CA',  nameEn: 'El Mamoura Co.',                           nameAr: 'المعمورة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 10.00  },
  { ticker: 'NARE',  yahoo: 'NARE.CA',  nameEn: 'Naeem Real Estate Holding Group',          nameAr: 'نعيم للاستثمار العقاري',                sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 20.45  },
  { ticker: 'NHPS',  yahoo: 'NHPS.CA',  nameEn: 'National Housing for Professional Syndicates', nameAr: 'الوطنية للإسكان للنقابات المهنية',  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 81.13  },
  { ticker: 'OBRI',  yahoo: 'OBRI.CA',  nameEn: 'El Obour Real Estate Investment',          nameAr: 'العبور للاستثمار العقاري',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 36.90  },
  { ticker: 'PRDC',  yahoo: 'PRDC.CA',  nameEn: 'Pioneers Properties for Urban Development', nameAr: 'رواد للتطوير العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.54   },
  { ticker: 'TANM',  yahoo: 'TANM.CA',  nameEn: 'Tanmiya for Real Estate Investment',       nameAr: 'تنمية للاستثمار العقاري',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.66   },
  { ticker: 'UEGC',  yahoo: 'UEGC.CA',  nameEn: 'El-Saeed Contracting & Real Estate Investment', nameAr: 'السعيد للمقاولات والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',          fallbackPrice: 1.86   },
  { ticker: 'UTOP',  yahoo: 'UTOP.CA',  nameEn: 'Utopia Real Estate Investment & Tourism',  nameAr: 'يوتوبيا للاستثمار العقاري والسياحي',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 80.00  },
  { ticker: 'ADRI',  yahoo: 'ADRI.CA',  nameEn: 'Arab Development & Real Estate Investment', nameAr: 'العربية للتنمية والاستثمار العقاري',   sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.25   },
  { ticker: 'GGCC',  yahoo: 'GGCC.CA',  nameEn: 'Giza General Contracting & Real Estate',   nameAr: 'الجيزة للمقاولات العامة والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',      fallbackPrice: 0.58   },
  { ticker: 'COPR',  yahoo: 'COPR.CA',  nameEn: 'Cooper for Commercial Investment & Real Estate', nameAr: 'كوبر للاستثمار التجاري والعقاري', sector: 'Real Estate', industry: 'Real Estate',            fallbackPrice: 0.36   },
  { ticker: 'AFDI',  yahoo: 'AFDI.CA',  nameEn: 'Alahly For Development & Investment',      nameAr: 'الأهلي للتنمية والاستثمار',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 47.00  },

  // ─── Hotels & Tourism (11) ────────────────────────────────────────────────
  { ticker: 'EGOTH', yahoo: 'EGOTH.CA', nameEn: 'El Masreyah Tourism',                      nameAr: 'المصرية للسياحة',                       sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 100.00 },
  { ticker: 'EITP',  yahoo: 'EITP.CA',  nameEn: 'Egyptian International Tourism Projects',  nameAr: 'مشروعات السياحة الدولية المصرية',       sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 8.01   },
  { ticker: 'MHOT',  yahoo: 'MHOT.CA',  nameEn: 'Misr Hotels',                              nameAr: 'مصر للفنادق',                           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 16.50  },
  { ticker: 'MITR',  yahoo: 'MITR.CA',  nameEn: 'Misr Travel',                              nameAr: 'مصر للسفر والسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 6.00   },
  { ticker: 'MMAT',  yahoo: 'MMAT.CA',  nameEn: 'Marsa Alam Tourism Development',           nameAr: 'مرسى علم للتطوير السياحي',              sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 3.70   },
  { ticker: 'PHTV',  yahoo: 'PHTV.CA',  nameEn: 'Pyramisa Hotels',                          nameAr: 'فنادق بيراميسا',                        sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 301.85 },
  { ticker: 'RMTV',  yahoo: 'RMTV.CA',  nameEn: 'Rowad Misr Tourism Investment',            nameAr: 'رواد مصر للاستثمار السياحي',            sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 100.00 },
  { ticker: 'ROTO',  yahoo: 'ROTO.CA',  nameEn: 'Rowad Tourism Co.',                        nameAr: 'الرواد للسياحة',                        sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 44.25  },
  { ticker: 'SDTI',  yahoo: 'SDTI.CA',  nameEn: 'Sharm Dreams Tourism Investment',          nameAr: 'أحلام شرم للاستثمار السياحي',           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 47.73  },
  { ticker: 'SPHT',  yahoo: 'SPHT.CA',  nameEn: 'El Shams Pyramids Hotels & Tourism',       nameAr: 'الشمس والأهرامات للفنادق والمشاريع السياحية', sector: 'Hotels & Tourism', industry: 'Hotels', fallbackPrice: 1.91   },
  { ticker: 'TRTO',  yahoo: 'TRTO.CA',  nameEn: 'TransOceans Tours',                        nameAr: 'ترانس أوشن للسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 0.03   },

  // ─── Telecommunications (2) ───────────────────────────────────────────────
  { ticker: 'ETEL',  yahoo: 'ETEL.CA',  nameEn: 'Telecom Egypt',                            nameAr: 'المصرية للاتصالات',                     sector: 'Telecommunications', industry: 'Fixed Line Telecoms', fallbackPrice: 98.50 },
  { ticker: 'GTHE',  yahoo: 'GTHE.CA',  nameEn: 'Global Telecom Holding',                   nameAr: 'جلوبال تيليكوم القابضة',                sector: 'Telecommunications', industry: 'Mobile Telecoms',     fallbackPrice: 3.60  },

  // ─── Industrial (31) ──────────────────────────────────────────────────────
  { ticker: 'SWDY',  yahoo: 'SWDY.CA',  nameEn: 'El Sewedy Electric',                       nameAr: 'السويدي إليكتريك',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 88.77  },
  { ticker: 'EAST',  yahoo: 'EAST.CA',  nameEn: 'Eastern Company',                          nameAr: 'الشركة الشرقية للدخان',                 sector: 'Industrial', industry: 'Tobacco',                    fallbackPrice: 36.64  },
  { ticker: 'ORAS',  yahoo: 'ORAS.CA',  nameEn: 'Orascom Construction',                     nameAr: 'أوراسكوم للإنشاء والصناعة',             sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 683.01 },
  { ticker: 'MOIL',  yahoo: 'MOIL.CA',  nameEn: 'Maridive & Oil Services',                  nameAr: 'ماريديف والنفط للخدمات',                sector: 'Industrial', industry: 'Oil Services',               fallbackPrice: 0.52   },
  { ticker: 'EGAL',  yahoo: 'EGAL.CA',  nameEn: 'Egypt Aluminum',                           nameAr: 'مصر للألومنيوم',                        sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 293.00 },
  { ticker: 'ALUM',  yahoo: 'ALUM.CA',  nameEn: 'Arab Aluminum',                            nameAr: 'العربية للألومنيوم',                    sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 22.86  },
  { ticker: 'MPRC',  yahoo: 'MPRC.CA',  nameEn: 'Egyptian Media Production City',           nameAr: 'مدينة الإنتاج الإعلامي',               sector: 'Industrial', industry: 'Media & Entertainment',      fallbackPrice: 42.25  },
  { ticker: 'ENGC',  yahoo: 'ENGC.CA',  nameEn: 'Industrial Engineering Co. for Construction', nameAr: 'الصناعات الهندسية إيديال',          sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 42.61  },
  { ticker: 'ASCM',  yahoo: 'ASCM.CA',  nameEn: 'ASEC for Mining (Ascom)',                  nameAr: 'أسيك للتعدين أسكوم',                    sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 62.21  },
  { ticker: 'COSG',  yahoo: 'COSG.CA',  nameEn: 'Cairo Oils & Soap',                        nameAr: 'القاهرة للزيوت والصابون',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 1.63   },
  { ticker: 'EEII',  yahoo: 'EEII.CA',  nameEn: 'El Arabia Engineering Industries',         nameAr: 'العربية للصناعات الهندسية',             sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 2.81   },
  { ticker: 'ACFR',  yahoo: 'ACFR.CA',  nameEn: 'Alexandria Company for Refractories',      nameAr: 'الإسكندرية للحراريات',                  sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'ANCC',  yahoo: 'ANCC.CA',  nameEn: 'ALNAHDA Industrial Co.',                   nameAr: 'النهضة للصناعات الوطنية',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'ARVA',  yahoo: 'ARVA.CA',  nameEn: 'Arab Valves',                              nameAr: 'العربية للصمامات الصناعية',             sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.85  },
  { ticker: 'ATQA',  yahoo: 'ATQA.CA',  nameEn: 'Misr National Steel',                      nameAr: 'مصر الوطنية للصلب',                     sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 9.59   },
  { ticker: 'DTPP',  yahoo: 'DTPP.CA',  nameEn: 'Delta for Printing & Packaging',           nameAr: 'دلتا للطباعة والتغليف',                 sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 212.00 },
  { ticker: 'ELEC',  yahoo: 'ELEC.CA',  nameEn: 'Electro Cable Egypt',                      nameAr: 'إليكترو كابل مصر',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 2.15   },
  { ticker: 'EPPK',  yahoo: 'EPPK.CA',  nameEn: 'El Ahram for Printing & Packing',          nameAr: 'الأهرام للطباعة والتغليف',              sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 14.48  },
  { ticker: 'IRON',  yahoo: 'IRON.CA',  nameEn: 'Egyptian Iron & Steel',                    nameAr: 'الحديد والصلب المصرية',                 sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 32.43  },
  { ticker: 'IRAX',  yahoo: 'IRAX.CA',  nameEn: 'El Ezz Aldekhela Steel-Alexandria',        nameAr: 'عز الدخيلة للصلب الإسكندرية',           sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 1245.00},
  { ticker: 'ISMQ',  yahoo: 'ISMQ.CA',  nameEn: 'Iron & Steel for Mines & Quarries',        nameAr: 'الحديد والصلب للمناجم والمحاجر',        sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 9.70   },
  { ticker: 'MBEG',  yahoo: 'MBEG.CA',  nameEn: 'MB for Engineering & Contracting',         nameAr: 'إم بي للمقاولات والهندسة',              sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 4.04   },
  { ticker: 'MISR',  yahoo: 'MISR.CA',  nameEn: 'MISR Intercontinental for Granite & Marble', nameAr: 'مصر إنتركونتيننتال للجرانيت والرخام', sector: 'Industrial', industry: 'Diversified Industrials',   fallbackPrice: 5.78   },
  { ticker: 'NCCW',  yahoo: 'NCCW.CA',  nameEn: 'Nasr Co. for Civil Works',                 nameAr: 'النصر للأعمال المدنية',                 sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 6.43   },
  { ticker: 'NMIN',  yahoo: 'NMIN.CA',  nameEn: 'El Nasr Mining',                           nameAr: 'النصر للتعدين',                         sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 10.00  },
  { ticker: 'RAKT',  yahoo: 'RAKT.CA',  nameEn: 'Rakta Paper Manufacturing',                nameAr: 'راكتا للورق',                           sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 23.39  },
  { ticker: 'UNIP',  yahoo: 'UNIP.CA',  nameEn: 'Universal For Paper Industries',           nameAr: 'الوحدة للأوراق والكرتون',               sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 0.34   },
  { ticker: 'SMPP',  yahoo: 'SMPP.CA',  nameEn: 'Modern Shorouk Printing & Packaging',      nameAr: 'الشروق الحديثة للطباعة والتغليف',       sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 107.00 },
  { ticker: 'SINA',  yahoo: 'SINA.CA',  nameEn: 'Sinai Manganese Company',                  nameAr: 'شركة سيناء للمنجنيز',                   sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 15.00  },
  { ticker: 'IEEC',  yahoo: 'IEEC.CA',  nameEn: 'Industrial & Engineering Enterprises',     nameAr: 'المؤسسات الصناعية والهندسية',           sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.59   },
  { ticker: 'CFGH',  yahoo: 'CFGH.CA',  nameEn: 'Concrete Fashion Group',                   nameAr: 'كونكريت فاشون للصناعات التجارية',       sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.10   },
  { ticker: 'MTIE',  yahoo: 'MTIE.CA',  nameEn: 'MM Group for Industry & International Trade', nameAr: 'مجموعة إم إم للصناعة والتجارة الدولية', sector: 'Industrial', industry: 'Diversified Industrials', fallbackPrice: 9.40   },
  { ticker: 'FNAR',  yahoo: 'FNAR.CA',  nameEn: 'Al Fanar Contracting & Construction',      nameAr: 'الفنار للمقاولات والإنشاءات',           sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 12.20  },
  { ticker: 'GDWA',  yahoo: 'GDWA.CA',  nameEn: 'Gadwa For Industrial Development',         nameAr: 'جدوى للتنمية الصناعية',                 sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.82   },
  { ticker: 'GMCI',  yahoo: 'GMCI.CA',  nameEn: 'GMC Group for Industrial & Commercial',    nameAr: 'مجموعة جي إم سي للصناعة والتجارة',      sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 1.99   },
  { ticker: 'YAYT',  yahoo: 'YAYT.CA',  nameEn: 'Spring & Transportation Needs Manufacturing', nameAr: 'الينابيع لصناعة مستلزمات النقل',    sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'EFAC',  yahoo: 'EFAC.CA',  nameEn: 'Egyptian Ferro Alloys',                    nameAr: 'المصرية للسبائك الحديدية',              sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 10.00  },
  { ticker: 'DCRC',  yahoo: 'DCRC.CA',  nameEn: 'Delta Construction & Rebuilding',          nameAr: 'دلتا للإنشاء وإعادة البناء',            sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 50.00  },

  // ─── Chemicals & Fertilizers (12) ─────────────────────────────────────────
  { ticker: 'ABUK',  yahoo: 'ABUK.CA',  nameEn: 'Abu Kir Fertilizers & Chemical Industries', nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 69.60  },
  { ticker: 'SKPC',  yahoo: 'SKPC.CA',  nameEn: 'Sidi Kerir Petrochemicals',               nameAr: 'سيدي كرير للبتروكيماويات',               sector: 'Chemicals & Fertilizers', industry: 'Petrochemicals',   fallbackPrice: 16.36  },
  { ticker: 'MFPC',  yahoo: 'MFPC.CA',  nameEn: 'Misr Fertilizers Production (MOPCO)',     nameAr: 'موبكو لإنتاج الأسمدة',                   sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 37.19  },
  { ticker: 'EGCH',  yahoo: 'EGCH.CA',  nameEn: 'Egyptian Chemical Industries (KIMA)',     nameAr: 'الصناعات الكيماوية المصرية كيما',        sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 13.08  },
  { ticker: 'PACH',  yahoo: 'PACH.CA',  nameEn: 'Egyptian Paints (Pachin)',                nameAr: 'باتشين للدهانات المصرية',                 sector: 'Chemicals & Fertilizers', industry: 'Paints & Coatings', fallbackPrice: 77.00 },
  { ticker: 'MICH',  yahoo: 'MICH.CA',  nameEn: 'Misr Chemical Industries',               nameAr: 'مصر للصناعات الكيماوية',                 sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 37.51  },
  { ticker: 'SMFR',  yahoo: 'SMFR.CA',  nameEn: 'Samad Misr (EGYFERT)',                   nameAr: 'صامد مصر للأسمدة',                       sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 204.00 },
  { ticker: 'KZPC',  yahoo: 'KZPC.CA',  nameEn: 'Kafr El Zayat Pesticides & Chemical',    nameAr: 'كفر الزيات للمبيدات والمواد الكيماوية',  sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 8.45   },
  { ticker: 'NFCI',  yahoo: 'NFCI.CA',  nameEn: 'ELNASR Co For Fertilizers & Chemicals',  nameAr: 'النصر للأسمدة والصناعات الكيماوية',      sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 10.00  },
  { ticker: 'ELAB',  yahoo: 'ELAB.CA',  nameEn: 'Egyptian Linear Alkyl Benzene (ELAB)',   nameAr: 'المصرية للألكيل بنزين الخطي',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 0.10   },
  { ticker: 'CID',   yahoo: 'CID.CA',   nameEn: 'Chemical & Industrial Development',      nameAr: 'الكيماويات والتنمية الصناعية',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 10.00  },
  { ticker: 'MOSC',  yahoo: 'MOSC.CA',  nameEn: 'Misr Oils & Soap',                       nameAr: 'مصر للزيوت والصابون',                    sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 277.24 },

  // ─── Energy (8) ───────────────────────────────────────────────────────────
  { ticker: 'AMOC',  yahoo: 'AMOC.CA',  nameEn: 'Alexandria Mineral Oils Company',         nameAr: 'الإسكندرية للزيوت المعدنية',             sector: 'Energy', industry: 'Oil Refining',         fallbackPrice: 8.02   },
  { ticker: 'INEG',  yahoo: 'INEG.CA',  nameEn: 'Integrated Engineering Group',            nameAr: 'المجموعة الهندسية المتكاملة',            sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.45   },
  { ticker: 'NDRL',  yahoo: 'NDRL.CA',  nameEn: 'National Drilling Company',               nameAr: 'الشركة القومية للحفر',                   sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 4.69   },
  { ticker: 'PMSC',  yahoo: 'PMSC.CA',  nameEn: 'Petroleum Marine Services',               nameAr: 'خدمات النفط البحرية',                    sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 10.00  },
  { ticker: 'TAQA',  yahoo: 'TAQA.CA',  nameEn: 'TAQA Arabia',                             nameAr: 'طاقة العربية',                           sector: 'Energy', industry: 'Diversified Energy',   fallbackPrice: 14.60  },
  { ticker: 'EGAS',  yahoo: 'EGAS.CA',  nameEn: 'Egypt Gas Co.',                           nameAr: 'مصر للغاز',                             sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 50.00  },
  { ticker: 'ENPI',  yahoo: 'ENPI.CA',  nameEn: 'Engineering for Petroleum (Enppi)',        nameAr: 'الهندسة البترولية إنبي',                 sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.13   },
  { ticker: 'GSSC',  yahoo: 'GSSC.CA',  nameEn: 'General Silos & Storage',                 nameAr: 'الشركة العامة للصوامع والتخزين',         sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 258.77 },

  // ─── Construction Materials (17) ──────────────────────────────────────────
  { ticker: 'SUCE',  yahoo: 'SUCE.CA',  nameEn: 'Suez Cement',                             nameAr: 'أسمنت السويس',                          sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.00  },
  { ticker: 'MCQE',  yahoo: 'MCQE.CA',  nameEn: 'Misr Cement (Qena)',                      nameAr: 'أسمنت مصر قنا',                         sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 175.88 },
  { ticker: 'LCSW',  yahoo: 'LCSW.CA',  nameEn: 'Lecico Egypt',                            nameAr: 'ليسيكو مصر للسيراميك',                  sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 31.88  },
  { ticker: 'CERA',  yahoo: 'CERA.CA',  nameEn: 'Arab Ceramic Co. (Ceramica Remas)',       nameAr: 'العربية للسيراميك سيراميكا ريماس',       sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 1.32   },
  { ticker: 'SCEM',  yahoo: 'SCEM.CA',  nameEn: 'Sinai Cement',                            nameAr: 'أسمنت سيناء',                           sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 62.53  },
  { ticker: 'SVCE',  yahoo: 'SVCE.CA',  nameEn: 'South Valley Cement',                     nameAr: 'أسمنت وادي النيل',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 9.40   },
  { ticker: 'ARCC',  yahoo: 'ARCC.CA',  nameEn: 'Arabian Cement Company',                  nameAr: 'الأسمنت العربي',                        sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 55.29  },
  { ticker: 'ALEX',  yahoo: 'ALEX.CA',  nameEn: 'Alexandria Cement',                       nameAr: 'أسمنت الإسكندرية',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.00  },
  { ticker: 'MBSC',  yahoo: 'MBSC.CA',  nameEn: 'Misr Beni Suef Cement',                   nameAr: 'مصر بني سويف للأسمنت',                  sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 241.00 },
  { ticker: 'TORA',  yahoo: 'TORA.CA',  nameEn: 'Tourah Cement',                           nameAr: 'أسمنت طرة',                             sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 69.00  },
  { ticker: 'ECAP',  yahoo: 'ECAP.CA',  nameEn: 'El Ezz Ceramics & Porcelain (Gemma)',     nameAr: 'عز للسيراميك والبورسلين جيما',          sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 32.32  },
  { ticker: 'MEGM',  yahoo: 'MEGM.CA',  nameEn: 'Middle East Glass Manufacturing',         nameAr: 'الشرق الأوسط لصناعة الزجاج',           sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 12.54  },
  { ticker: 'PRCL',  yahoo: 'PRCL.CA',  nameEn: 'General Co. for Ceramic & Porcelain',    nameAr: 'الشركة العامة للسيراميك والبورسلين',     sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 35.32  },
  { ticker: 'RUBX',  yahoo: 'RUBX.CA',  nameEn: 'Rubex International for Plastic & Acrylic', nameAr: 'روبكس الدولية للبلاستيك والأكريليك', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 13.25  },
  { ticker: 'WATP',  yahoo: 'WATP.CA',  nameEn: 'Modern Co. for Water Proofing',           nameAr: 'الحديثة للعزل المائي والحراري',         sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 24.00  },
  { ticker: 'SIEG',  yahoo: 'SIEG.CA',  nameEn: 'Egyptian Co. for Pipes & Cement Products (Siegwart)', nameAr: 'المصرية للأنابيب ومنتجات الأسمنت سيغوارت', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 10.00 },
  { ticker: 'KNGC',  yahoo: 'KNGC.CA',  nameEn: 'El Nasr Glass and Crystal',               nameAr: 'النصر للزجاج والبلور',                  sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 10.00  },

  // ─── Healthcare (19) ──────────────────────────────────────────────────────
  { ticker: 'CLHO',  yahoo: 'CLHO.CA',  nameEn: 'Cleopatra Hospital Group',                nameAr: 'مجموعة مستشفيات كليوباترا',             sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 16.31  },
  { ticker: 'PHAR',  yahoo: 'PHAR.CA',  nameEn: 'EIPICO',                                  nameAr: 'الشركة المصرية الدولية للأدوية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 86.07  },
  { ticker: 'SPMD',  yahoo: 'SPMD.CA',  nameEn: 'Speed Medical',                           nameAr: 'سبيد ميدكال للتشخيص',                   sector: 'Healthcare', industry: 'Diagnostics',         fallbackPrice: 0.45   },
  { ticker: 'RMDA',  yahoo: 'RMDA.CA',  nameEn: 'Rameda Pharmaceutical',                   nameAr: 'راميدا للأدوية',                        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 5.00   },
  { ticker: 'ISPH',  yahoo: 'ISPH.CA',  nameEn: 'Ibn Sina Pharma',                         nameAr: 'ابن سينا للأدوية والمستلزمات',          sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 11.50  },
  { ticker: 'ADCI',  yahoo: 'ADCI.CA',  nameEn: 'Arab Pharmaceuticals',                    nameAr: 'العربية للمستحضرات الصيدلانية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 233.10 },
  { ticker: 'AMES',  yahoo: 'AMES.CA',  nameEn: 'Alexandria New Medical Center',           nameAr: 'مجمع الإسكندرية الطبي الجديد',          sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 83.89  },
  { ticker: 'APPC',  yahoo: 'APPC.CA',  nameEn: 'Advanced Pharmaceutical Packaging',       nameAr: 'التعبئة الدوائية المتقدمة',             sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.36   },
  { ticker: 'AXPH',  yahoo: 'AXPH.CA',  nameEn: 'Alexandria Pharmaceuticals & Chemical',  nameAr: 'الإسكندرية للأدوية والمواد الكيماوية',  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1200.00},
  { ticker: 'BIOC',  yahoo: 'BIOC.CA',  nameEn: 'GlaxoSmithKline Egypt',                   nameAr: 'جلاكسو سميث كلاين مصر',                sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 73.60  },
  { ticker: 'FCMD',  yahoo: 'FCMD.CA',  nameEn: 'Future Care for Medical Industries',      nameAr: 'المستقبل للصناعات الطبية',              sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 6.40   },
  { ticker: 'MCRO',  yahoo: 'MCRO.CA',  nameEn: 'Macro Group Pharmaceutical',              nameAr: 'ماكرو جروب للأدوية',                    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.33   },
  { ticker: 'MEPA',  yahoo: 'MEPA.CA',  nameEn: 'Medical Packaging Co.',                   nameAr: 'التغليف الطبي',                         sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 1.66   },
  { ticker: 'MIPH',  yahoo: 'MIPH.CA',  nameEn: 'Minapharm Pharmaceuticals',               nameAr: 'منا فارم للصناعات الدوائية',            sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 700.00 },
  { ticker: 'MPCI',  yahoo: 'MPCI.CA',  nameEn: 'Memphis Pharmaceutical & Chemical',       nameAr: 'ممفيس للصناعات الدوائية والكيماوية',    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 239.71 },
  { ticker: 'NIPH',  yahoo: 'NIPH.CA',  nameEn: 'El-Nile Pharmaceuticals & Chemical',      nameAr: 'النيل للأدوية والصناعات الكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 176.05 },
  { ticker: 'OCPH',  yahoo: 'OCPH.CA',  nameEn: 'October Pharma',                          nameAr: 'أكتوبر فارما للأدوية',                  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 355.00 },
  { ticker: 'SIPC',  yahoo: 'SIPC.CA',  nameEn: 'Sabaa International for Pharmaceutical',  nameAr: 'سبأ الدولية للصناعات الدوائية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 3.50   },
  { ticker: 'UPMS',  yahoo: 'UPMS.CA',  nameEn: 'Union Pharmacist for Medical Services',   nameAr: 'اتحاد الصيادلة للخدمات الطبية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 12.75  },
  { ticker: 'NINH',  yahoo: 'NINH.CA',  nameEn: 'Nozha International Hospital',            nameAr: 'مستشفى النزهة الدولي',                  sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 17.70  },
  { ticker: 'CPCI',  yahoo: 'CPCI.CA',  nameEn: 'Kahira Pharmaceuticals & Chemical',       nameAr: 'القاهرة للأدوية والمواد الكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 401.00 },

  // ─── Food & Beverage (28) ─────────────────────────────────────────────────
  { ticker: 'JUFO',  yahoo: 'JUFO.CA',  nameEn: 'Juhayna Food Industries',                 nameAr: 'جهينة للأغذية والألبان',                sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 30.55  },
  { ticker: 'DOMT',  yahoo: 'DOMT.CA',  nameEn: 'Arabian Food Industries (Domty)',          nameAr: 'الشركة العربية لصناعات الأغذية دومتي', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 26.91  },
  { ticker: 'EFID',  yahoo: 'EFID.CA',  nameEn: 'Edita Food Industries',                   nameAr: 'أديتا للصناعات الغذائية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 28.27  },
  { ticker: 'POUL',  yahoo: 'POUL.CA',  nameEn: 'Cairo Poultry Group',                     nameAr: 'القاهرة للدواجن',                       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 40.10  },
  { ticker: 'AJWA',  yahoo: 'AJWA.CA',  nameEn: 'Ajwa Group for Food Industries Egypt',    nameAr: 'مجموعة أجواء للصناعات الغذائية',        sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 180.38 },
  { ticker: 'ISMA',  yahoo: 'ISMA.CA',  nameEn: 'Ismailia Misr Poultry',                  nameAr: 'الإسماعيلية مصر للدواجن',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 27.25  },
  { ticker: 'IFAP',  yahoo: 'IFAP.CA',  nameEn: 'International Agricultural Products',     nameAr: 'المنتجات الزراعية الدولية',             sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 19.55  },
  { ticker: 'OLFI',  yahoo: 'OLFI.CA',  nameEn: 'Obour Land for Food Industries',          nameAr: 'أرض العبور للصناعات الغذائية',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 23.00  },
  { ticker: 'INFI',  yahoo: 'INFI.CA',  nameEn: 'Ismailia National Food Industries',       nameAr: 'الإسماعيلية الوطنية للصناعات الغذائية', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 103.20 },
  { ticker: 'SUGR',  yahoo: 'SUGR.CA',  nameEn: 'Delta Sugar',                             nameAr: 'دلتا للسكر',                            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 46.93  },
  { ticker: 'AFMC',  yahoo: 'AFMC.CA',  nameEn: 'Alexandria Flour Mills',                  nameAr: 'مطاحن الإسكندرية',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 72.95  },
  { ticker: 'MILS',  yahoo: 'MILS.CA',  nameEn: 'North Cairo Mills',                       nameAr: 'مطاحن شمال القاهرة',                    sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 137.14 },
  { ticker: 'SCFM',  yahoo: 'SCFM.CA',  nameEn: 'South Cairo & Giza Mills',                nameAr: 'مطاحن جنوب القاهرة والجيزة',           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 255.04 },
  { ticker: 'WCDF',  yahoo: 'WCDF.CA',  nameEn: 'Middle & West Delta Flour Mills',         nameAr: 'مطاحن وسط وغرب الدلتا',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 519.00 },
  { ticker: 'UEFM',  yahoo: 'UEFM.CA',  nameEn: 'Upper Egypt Flour Mills',                 nameAr: 'مطاحن الصعيد',                          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 505.62 },
  { ticker: 'EDFM',  yahoo: 'EDFM.CA',  nameEn: 'East Delta Flour Mills',                  nameAr: 'مطاحن شرق الدلتا',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 346.58 },
  { ticker: 'CEFM',  yahoo: 'CEFM.CA',  nameEn: 'Middle Egypt Flour Mills',                nameAr: 'مطاحن وسط مصر',                         sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 105.00 },
  { ticker: 'SNFC',  yahoo: 'SNFC.CA',  nameEn: 'Sharkia National Food',                   nameAr: 'الشركية الوطنية للأغذية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.90  },
  { ticker: 'SNFI',  yahoo: 'SNFI.CA',  nameEn: 'Souhag National Food Industries',         nameAr: 'سوهاج الوطنية للصناعات الغذائية',       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 10.87  },
  { ticker: 'EPCO',  yahoo: 'EPCO.CA',  nameEn: 'Egypt for Poultry Co.',                   nameAr: 'مصر للدواجن',                           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 9.19   },
  { ticker: 'MPCO',  yahoo: 'MPCO.CA',  nameEn: 'Mansourah Poultry',                       nameAr: 'المنصورة للدواجن',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 1.88   },
  { ticker: 'GOUR',  yahoo: 'GOUR.CA',  nameEn: 'Gourmet Egypt Foods',                     nameAr: 'جورميه مصر للأغذية',                   sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 14.21  },
  { ticker: 'ZEOT',  yahoo: 'ZEOT.CA',  nameEn: 'Extracted Oils & Derivatives',            nameAr: 'الزيوت المستخلصة ومشتقاتها',            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.30  },
  { ticker: 'ADPC',  yahoo: 'ADPC.CA',  nameEn: 'Arab Dairy Products (Panda)',              nameAr: 'منتجات الألبان العربية بانده',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 3.70   },
  { ticker: 'AIFI',  yahoo: 'AIFI.CA',  nameEn: 'Atlas for Investment & Food Industries',  nameAr: 'أطلس للاستثمار والصناعات الغذائية',     sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 2.07   },
  { ticker: 'ELNA',  yahoo: 'ELNA.CA',  nameEn: 'El Nasr for Manufacturing Agricultural Crops', nameAr: 'النصر لتصنيع المحاصيل الزراعية',  sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 39.16  },
  { ticker: 'MFSC',  yahoo: 'MFSC.CA',  nameEn: 'Misr Duty Free Shops',                    nameAr: 'مصر للمحلات الحرة',                     sector: 'Food & Beverage', industry: 'Retail',            fallbackPrice: 45.67  },
  { ticker: 'KABO',  yahoo: 'KABO.CA',  nameEn: 'El Nasr Clothing & Textiles',             nameAr: 'النصر للملابس والمنسوجات',              sector: 'Textile',         industry: 'Apparel',           fallbackPrice: 7.55   },

  // ─── Technology (10) ──────────────────────────────────────────────────────
  { ticker: 'FWRY',  yahoo: 'FWRY.CA',  nameEn: 'Fawry for Banking Technology & Electronic Payment', nameAr: 'فوري للبنوك والمدفوعات الإلكترونية', sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 19.34 },
  { ticker: 'EFIH',  yahoo: 'EFIH.CA',  nameEn: 'e-finance for Digital & Financial Investments',     nameAr: 'إي فاينانس للاستثمارات الرقمية',      sector: 'Technology', industry: 'Digital Finance',     fallbackPrice: 22.30 },
  { ticker: 'VERT',  yahoo: 'VERT.CA',  nameEn: 'Vertika for Industry & Trade',            nameAr: 'فيرتيكا للصناعة والتجارة',              sector: 'Technology', industry: 'Technology Services', fallbackPrice: 8.09   },
  { ticker: 'RACC',  yahoo: 'RACC.CA',  nameEn: 'Raya Contact Center',                     nameAr: 'رايا لخدمات مراكز الاتصال',             sector: 'Technology', industry: 'Technology Services', fallbackPrice: 10.18  },
  { ticker: 'AMPI',  yahoo: 'AMPI.CA',  nameEn: 'AL Moasher Pay for Electronic Payment',   nameAr: 'المؤشر باي للمدفوعات الإلكترونية',      sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 2.83   },
  { ticker: 'DGTZ',  yahoo: 'DGTZ.CA',  nameEn: 'Digitize for Investment & Technology',    nameAr: 'ديجيتايز للاستثمار والتكنولوجيا',       sector: 'Technology', industry: 'Technology Services', fallbackPrice: 2.65   },
  { ticker: 'EGSA',  yahoo: 'EGSA.CA',  nameEn: 'Egyptian Satellite Co.',                  nameAr: 'الشركة المصرية للقمر الصناعي',          sector: 'Technology', industry: 'Satellite & Telecom', fallbackPrice: 9.00   },
  { ticker: 'SCTS',  yahoo: 'SCTS.CA',  nameEn: 'Suez Canal Co. for Technology Settling',  nameAr: 'قناة السويس للتكنولوجيا والتسويات',     sector: 'Technology', industry: 'Technology Services', fallbackPrice: 613.13 },
  { ticker: 'FTNS',  yahoo: 'FTNS.CA',  nameEn: 'Fitness Prime',                           nameAr: 'فيتنس برايم',                           sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.18   },
  { ticker: 'GEOS',  yahoo: 'GEOS.CA',  nameEn: 'Geos for Trading and Contracting',        nameAr: 'جيوس للتجارة والمقاولات',               sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.00   },

  // ─── Textile (9) ──────────────────────────────────────────────────────────
  { ticker: 'ORWE',  yahoo: 'ORWE.CA',  nameEn: 'Oriental Weavers Carpet',                 nameAr: 'الشرقية للسجاد',                        sector: 'Textile', industry: 'Carpets & Flooring',     fallbackPrice: 22.68  },
  { ticker: 'DSCW',  yahoo: 'DSCW.CA',  nameEn: 'Dice Sport & Casual Wear Manufacturers',  nameAr: 'دايس للملابس الرياضية',                 sector: 'Textile', industry: 'Apparel',                fallbackPrice: 1.79   },
  { ticker: 'ACGC',  yahoo: 'ACGC.CA',  nameEn: 'Arab Cotton Ginning',                     nameAr: 'العربية لحلج الأقطان',                  sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 9.86   },
  { ticker: 'APSW',  yahoo: 'APSW.CA',  nameEn: 'Arab Polvara Spinning & Weaving',         nameAr: 'العربية بولفارة للغزل والنسيج',         sector: 'Textile', industry: 'Textiles',               fallbackPrice: 8.45   },
  { ticker: 'GTWL',  yahoo: 'GTWL.CA',  nameEn: 'Golden Textiles & Clothes Wool',          nameAr: 'الذهبية للمنسوجات والملابس والصوف',     sector: 'Textile', industry: 'Textiles',               fallbackPrice: 112.00 },
  { ticker: 'NCGC',  yahoo: 'NCGC.CA',  nameEn: 'Nile Cotton Ginning',                     nameAr: 'النيل لحلج الأقطان',                    sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 51.00  },
  { ticker: 'SPIN',  yahoo: 'SPIN.CA',  nameEn: 'Alexandria Spinning & Weaving',           nameAr: 'الإسكندرية للغزل والنسيج',              sector: 'Textile', industry: 'Textiles',               fallbackPrice: 14.60  },
  { ticker: 'GTEX',  yahoo: 'GTEX.CA',  nameEn: 'G-TEX for Commercial and Industrial',     nameAr: 'جي تكس للاستثمارات التجارية والصناعية', sector: 'Textile', industry: 'Textiles',               fallbackPrice: 0.04   },

  // ─── Agriculture (7) ──────────────────────────────────────────────────────
  { ticker: 'AALR',  yahoo: 'AALR.CA',  nameEn: 'General Co. for Land Reclamation',        nameAr: 'الشركة العامة لاستصلاح الأراضي',        sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 236.04 },
  { ticker: 'EALR',  yahoo: 'EALR.CA',  nameEn: 'El Arabia for Land Reclamation',          nameAr: 'العربية لاستصلاح الأراضي',              sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 372.50 },
  { ticker: 'GGRN',  yahoo: 'GGRN.CA',  nameEn: 'Gogreen Agricultural Investment',         nameAr: 'جو جرين للاستثمار والتنمية الزراعية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 1.45   },
  { ticker: 'KRDI',  yahoo: 'KRDI.CA',  nameEn: 'Al Khair River for Agricultural Development', nameAr: 'الخير للتنمية الزراعية والبيئية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.35   },
  { ticker: 'LUTS',  yahoo: 'LUTS.CA',  nameEn: 'Lotus Agricultural Investments',          nameAr: 'لوتس للاستثمارات الزراعية',             sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.74   },
  { ticker: 'NEDA',  yahoo: 'NEDA.CA',  nameEn: 'Northern Upper Egypt Development & Agricultural', nameAr: 'شمال الصعيد للتنمية والإنتاج الزراعي', sector: 'Agriculture', industry: 'Agriculture', fallbackPrice: 2.79   },
  { ticker: 'WKOL',  yahoo: 'WKOL.CA',  nameEn: 'Wadi Kom Ombo Land Reclamation',          nameAr: 'وادي كوم أمبو لاستصلاح الأراضي',       sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 320.50 },

  // ─── Missing from earlier — confirmed in TradingView scanner ─────────────
  { ticker: 'SAUD',  yahoo: 'SAUD.CA',  nameEn: 'Al Baraka Bank Egypt',                    nameAr: 'بنك البركة مصر',                        sector: 'Banking',            industry: 'Islamic Banking',       fallbackPrice: 21.61  },
  { ticker: 'ARAB',  yahoo: 'ARAB.CA',  nameEn: 'Arab Developers Holding',                 nameAr: 'العرب للتطوير العقاري القابضة',          sector: 'Real Estate',        industry: 'Real Estate Development', fallbackPrice: 0.24   },
  { ticker: 'DAPH',  yahoo: 'DAPH.CA',  nameEn: 'Development & Engineering Consultants',   nameAr: 'التنمية والاستشارات الهندسية',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 85.20  },
  { ticker: 'HBCO',  yahoo: 'HBCO.CA',  nameEn: 'Heibco',                                  nameAr: 'هيبكو',                                 sector: 'Industrial',         industry: 'Diversified Industrials', fallbackPrice: 13.52  },

  // ─── Insurance (3) ────────────────────────────────────────────────────────
  { ticker: 'DEIN',  yahoo: 'DEIN.CA',  nameEn: 'Delta Insurance',                         nameAr: 'دلتا للتأمين',                          sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 10.35  },
  { ticker: 'MOIN',  yahoo: 'MOIN.CA',  nameEn: 'Mohandes Insurance',                      nameAr: 'المهندس للتأمين',                       sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 23.96  },
  { ticker: 'MLIC',  yahoo: 'MLIC.CA',  nameEn: 'Misr Life Insurance',                     nameAr: 'مصر للتأمين على الحياة',                sector: 'Insurance', industry: 'Life Insurance',       fallbackPrice: 10.00  },

  // ─── Education (4) ────────────────────────────────────────────────────────
  { ticker: 'CIRA',  yahoo: 'CIRA.CA',  nameEn: 'CIRA Education',                          nameAr: 'سيرا للتعليم',                          sector: 'Education', industry: 'Education Services',   fallbackPrice: 31.53  },
  { ticker: 'CAED',  yahoo: 'CAED.CA',  nameEn: 'Cairo Educational Services',              nameAr: 'القاهرة للخدمات التعليمية',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 74.78  },
  { ticker: 'EEP',   yahoo: 'EEP.CA',   nameEn: 'Egypt Education Platform',                nameAr: 'المنصة المصرية للتعليم',                sector: 'Education', industry: 'Education Services',   fallbackPrice: 1.00   },
  { ticker: 'TALM',  yahoo: 'TALM.CA',  nameEn: 'Taaleem Management Services',             nameAr: 'تعليم لإدارة الخدمات',                  sector: 'Education', industry: 'Education Services',   fallbackPrice: 15.50  },
  { ticker: 'MOED',  yahoo: 'MOED.CA',  nameEn: 'Egyptian Modern Education Systems',       nameAr: 'الأنظمة التعليمية الحديثة',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 0.72   },

  // ─── Transportation (7) ───────────────────────────────────────────────────
  { ticker: 'ALCN',  yahoo: 'ALCN.CA',  nameEn: 'Alexandria Container & Cargo Handling',   nameAr: 'الإسكندرية للحاويات والشحن',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 29.90  },
  { ticker: 'ETRS',  yahoo: 'ETRS.CA',  nameEn: 'Egyptian Transport (Egytrans)',            nameAr: 'مصر للنقل إيجيترانس',                   sector: 'Transportation', industry: 'Road Transport',   fallbackPrice: 10.90  },
  { ticker: 'CSAG',  yahoo: 'CSAG.CA',  nameEn: 'Canal Shipping Agencies',                 nameAr: 'وكلاء الشحن بالقنال',                   sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 32.59  },
  { ticker: 'DCCC',  yahoo: 'DCCC.CA',  nameEn: 'Damietta Container & Cargo Handling',     nameAr: 'دمياط للحاويات والبضائع',               sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 10.00  },
  { ticker: 'POCO',  yahoo: 'POCO.CA',  nameEn: 'Port Said Container & Cargo Handling',    nameAr: 'بور سعيد للحاويات والبضائع',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 5.00   },
  { ticker: 'EGWA',  yahoo: 'EGWA.CA',  nameEn: 'General Warehouses of Egypt',             nameAr: 'المخازن العمومية المصرية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 5.00   },
  { ticker: 'BIDI',  yahoo: 'BIDI.CA',  nameEn: 'El Badr Investment and Development',      nameAr: 'البدر للاستثمار والتنمية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 1.76   },

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
