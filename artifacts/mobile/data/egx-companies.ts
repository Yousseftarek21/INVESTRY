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
  { ticker: 'COMI',  yahoo: 'COMI.CA',  nameEn: 'Commercial International Bank - Egypt (CIB) S.A.E.',     nameAr: 'البنك التجاري الدولي (CIB)',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 136.90 },
  { ticker: 'CIEB',  yahoo: 'CIEB.CA',  nameEn: 'Credit Agricole Egypt',                   nameAr: 'كريدي أجريكول مصر',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 24.40  },
  { ticker: 'ADIB',  yahoo: 'ADIB.CA',  nameEn: 'Abu Dhabi Islamic Bank-Egypt',             nameAr: 'بنك أبو ظبي الإسلامي مصر',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 46.50  },
  { ticker: 'HDBK',  yahoo: 'HDBK.CA',  nameEn: 'Housing & Development Bank',              nameAr: 'بنك التعمير والإسكان',                   sector: 'Banking', industry: 'Banks',          fallbackPrice: 78.03  },
  { ticker: 'QNBE',  yahoo: 'QNBE.CA',  nameEn: 'Qatar National Bank',                              nameAr: 'بنك قطر الوطني الأهلي',                         sector: 'Banking', industry: 'Banks',          fallbackPrice: 54.90  },
  { ticker: 'NBKE',  yahoo: 'NBKE.CA',  nameEn: 'National Bank of Kuwait - Egypt',           nameAr: 'بنك الكويت الوطني مصر',                  sector: 'Banking', industry: 'Banks',          fallbackPrice: 32.40  },
  { ticker: 'CANA',  yahoo: 'CANA.CA',  nameEn: 'Suez Canal Bank SAE',                         nameAr: 'بنك قناة السويس',                        sector: 'Banking', industry: 'Banks',          fallbackPrice: 36.12  },
  { ticker: 'SAIB',  yahoo: 'SAIB.CA',  nameEn: 'Societe Arabe Internationale de Banque', nameAr: 'الشركة العربية الدولية للبنوك',           sector: 'Banking', industry: 'Banks',          fallbackPrice: 2.11   },
  { ticker: 'UBEE',  yahoo: 'UBEE.CA',  nameEn: 'United Bank SAE',                             nameAr: 'البنك المتحد',                           sector: 'Banking', industry: 'Banks',          fallbackPrice: 13.40  },
  { ticker: 'EXPA',  yahoo: 'EXPA.CA',  nameEn: 'Export Development Bank of Egypt',        nameAr: 'بنك تنمية الصادرات',                     sector: 'Banking', industry: 'Banks',          fallbackPrice: 18.69  },
  { ticker: 'EGBE',  yahoo: 'EGBE.CA',  nameEn: 'Egyptian Gulf Bank',                      nameAr: 'بنك الخليج المصري',                      sector: 'Banking', industry: 'Banks',          fallbackPrice: 0.46   },
  { ticker: 'FAIT',  yahoo: 'FAIT.CA',  nameEn: 'Faisal Islamic Bank of Egypt',            nameAr: 'بنك فيصل الإسلامي المصري',               sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 37.13  },
  { ticker: 'FAITA', yahoo: 'FAITA.CA', nameEn: 'Faisal Islamic Bank of Egypt', nameAr: 'بنك فيصل الإسلامي المصري (فئة ب)',      sector: 'Banking', industry: 'Islamic Banking', fallbackPrice: 0.98   },

  // ─── Financial Services (40) ──────────────────────────────────────────────
  { ticker: 'HRHO',  yahoo: 'HRHO.CA',  nameEn: 'EFG Holding S.A.E.',                             nameAr: 'إي إف جي القابضة',                 sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 26.66  },
  { ticker: 'CICH',  yahoo: 'CICH.CA',  nameEn: 'CI Capital Holding for Financial Investments',                      nameAr: 'سي آي كابيتال للاستثمارات المالية',                  sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 12.00  },
  { ticker: 'EFIC',  yahoo: 'EFIC.CA',  nameEn: 'Egyptian Financial & Industrial Co.',     nameAr: 'المصرية المالية والصناعية',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 187.70 },
  { ticker: 'GBCO',  yahoo: 'GBCO.CA',  nameEn: 'GB Corp',                                 nameAr: 'جي بي كوربوريشن',                        sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 31.81  },
  { ticker: 'CCAP',  yahoo: 'CCAP.CA',  nameEn: 'QALA For Financial Investments',          nameAr: 'قلعة للاستثمارات المالية',                sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 5.36   },
  { ticker: 'BINV',  yahoo: 'BINV.CA',  nameEn: 'B Investments Holding SAE',                   nameAr: 'بي إنفستمنتس القابضة',                   sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 48.88  },
  { ticker: 'BTFH',  yahoo: 'BTFH.CA',  nameEn: 'Beltone Holding',                         nameAr: 'بلتون القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 3.05   },
  { ticker: 'CNFN',  yahoo: 'CNFN.CA',  nameEn: 'Contact Financial Holding SAE',               nameAr: 'كونتاكت للاستثمار المالي القابضة',               sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 4.91   },
  { ticker: 'ACTF',  yahoo: 'ACTF.CA',  nameEn: 'Act Financial',                           nameAr: 'أكت للاستثمارات المالية',                sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 2.77   },
  { ticker: 'ASPI',  yahoo: 'ASPI.CA',  nameEn: 'Aspire Capital Holding for Financial Investments',                  nameAr: 'أسباير كابيتال للاستثمارات المالية',     sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.31   },
  { ticker: 'ATLC',  yahoo: 'ATLC.CA',  nameEn: 'Al Tawfeek Leasing Company-A.T.LEASE',                      nameAr: 'التوفيق للتأجير التمويلي',               sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 5.24   },
  { ticker: 'VALU',  yahoo: 'VALU.CA',  nameEn: 'U Consumer Finance S.A.E',                      nameAr: 'يو للتمويل الاستهلاكي',                  sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 12.80  },
  { ticker: 'RAYA',  yahoo: 'RAYA.CA',  nameEn: 'Raya Holding for Financial Investments SAE',  nameAr: 'رايا القابضة للاستثمارات المالية',        sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.29   },
  { ticker: 'ICLE',  yahoo: 'ICLE.CA',  nameEn: 'International Co. for Leasing SAE',           nameAr: 'الشركة الدولية للتأجير التمويلي',        sector: 'Financial Services', industry: 'Leasing',                 fallbackPrice: 15.76  },
  { ticker: 'ICFC',  yahoo: 'ICFC.CA',  nameEn: 'International Co. for Fertilizers & Chemicals', nameAr: 'الشركة الدولية للأسمدة والكيماويات', sector: 'Financial Services', industry: 'Diversified Financials', fallbackPrice: 15.09 },
  { ticker: 'MKIT',  yahoo: 'MKIT.CA',  nameEn: 'Misr Kuwait Investment & Trading Co.',        nameAr: 'مصر الكويت للاستثمار والتجارة',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.74   },
  { ticker: 'KWIN',  yahoo: 'KWIN.CA',  nameEn: 'El Kahera El Watania Investment',          nameAr: 'القاهرة الوطنية للاستثمار',              sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 68.86  },
  { ticker: 'NAHO',  yahoo: 'NAHO.CA',  nameEn: 'Naeem Holding Co.',                            nameAr: 'نعيم القابضة',                           sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 0.10   },
  { ticker: 'ODIN',  yahoo: 'ODIN.CA',  nameEn: 'ODIN Investments',                         nameAr: 'أودين للاستثمارات',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 2.48   },
  { ticker: 'OFH',   yahoo: 'OFH.CA',   nameEn: 'O B Financial Holding',                     nameAr: 'أو بي القابضة للاستثمارات المالية',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.63   },
  { ticker: 'OIH',   yahoo: 'OIH.CA',   nameEn: 'Orascom Investment Holding SAE',               nameAr: 'أوراسكوم للاستثمار القابضة',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 1.41   },
  { ticker: 'PRMH',  yahoo: 'PRMH.CA',  nameEn: 'Prime Holding',                            nameAr: 'برايم القابضة',                          sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.74   },
  { ticker: 'RKAZ',  yahoo: 'RKAZ.CA',  nameEn: 'REKAZ Financial Holding',                  nameAr: 'ركاز القابضة للاستثمار المالي',          sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 4.80   },
  { ticker: 'TYCN',  yahoo: 'TYCN.CA',  nameEn: 'Tycoon Holding Company For Financial Investments',                           nameAr: 'تايكون للاستثمارات المالية القابضة',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 23.26  },
  { ticker: 'TWSA',  yahoo: 'TWSA.CA',  nameEn: 'TAWASOA FOR FACTORING',                    nameAr: 'تواصل للتخصيم',                          sector: 'Financial Services', industry: 'Consumer Finance',        fallbackPrice: 6.70   },
  { ticker: 'GRCA',  yahoo: 'GRCA.CA',  nameEn: 'Grand Investment Capital',                 nameAr: 'جراند للاستثمار الرأسمالي',              sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 51.49  },
  { ticker: 'HAVC',  yahoo: 'HAVC.CA',  nameEn: 'Hassan Allam Investments & Venture Capital S.A.E', nameAr: 'حسن علام للاستثمارات ورأس المال المخاطر', sector: 'Financial Services', industry: 'Investment Banking',   fallbackPrice: 1.00   },
  { ticker: 'LKGP',  yahoo: 'LKGP.CA',  nameEn: 'The Holding Company for Financial Investment - The Lakah Group',                      nameAr: 'مجموعة لقا للاستثمارات المالية القابضة',                     sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.50   },
  { ticker: 'SEIG',  yahoo: 'SEIG.CA',  nameEn: 'Saudi Egyptian Investment & Finance Co. SAE',      nameAr: 'السعودية المصرية للاستثمار والتمويل',    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 259.07 },
  { ticker: 'SEIGA', yahoo: 'SEIGA.CA', nameEn: 'Saudi Egyptian Investment & Finance Co. SAE',  nameAr: 'السعودية المصرية للاستثمار والتمويل (فئة أ)', sector: 'Financial Services', industry: 'Investment Banking',     fallbackPrice: 0.95   },
  { ticker: 'VLMR',  yahoo: 'VLMR.CA',  nameEn: 'Valmore Holding',                          nameAr: 'فالمور القابضة',                         sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.66   },
  { ticker: 'VLMRA', yahoo: 'VLMRA.CA', nameEn: 'Valmore Holding',                       nameAr: 'فالمور القابضة (فئة أ)',                      sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 29.01  },
  { ticker: 'OCAP',  yahoo: 'OCAP.CA',  nameEn: 'OG Capital For Investments SPAC',               nameAr: 'أو جي كابيتال للاستثمارات',             sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 1.00   },
  { ticker: 'EASB',  yahoo: 'EASB.CA',  nameEn: 'Egyptian Arabian Company for Securities Brokerage EAC',    nameAr: 'الشركة المصرية العربية للوساطة في الأوراق المالية',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 7.17   },
  { ticker: 'EBSC',  yahoo: 'EBSC.CA',  nameEn: 'Osool ESB Securities Brokerage',           nameAr: 'أصول للوساطة في الأوراق المالية',        sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.92   },
  { ticker: 'EOSB',  yahoo: 'EOSB.CA',  nameEn: 'El Orouba Securities Brokerage',           nameAr: 'العروبة للوساطة في الأوراق المالية',     sector: 'Financial Services', industry: 'Brokerage',               fallbackPrice: 1.55   },
  { ticker: 'ACAMD', yahoo: 'ACAMD.CA', nameEn: 'Arab Co. for Asset Management & Development', nameAr: 'العربية لإدارة الأصول والتنمية',      sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 2.34   },
  { ticker: 'ACAP',  yahoo: 'ACAP.CA',  nameEn: 'A Capital Holding',                        nameAr: 'إيه كابيتال القابضة',                    sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 9.14   },
  { ticker: 'HDST',  yahoo: 'HDST.CA',  nameEn: 'HEDGESTONE INVESTMENT',                    nameAr: 'هيدج ستون للاستثمار',                    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.10   },
  { ticker: 'AIDC',  yahoo: 'AIDC.CA',  nameEn: 'Arabia for Investment and Development',    nameAr: 'العربية للاستثمار والتنمية',             sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.73   },
  { ticker: 'AIH',   yahoo: 'AIH.CA',   nameEn: 'Arabia Investments Holding SAE',               nameAr: 'العربية للاستثمارات القابضة',            sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.48   },
  { ticker: 'AMIA',  yahoo: 'AMIA.CA',  nameEn: 'Arab Moltaqa Investments Company',                 nameAr: 'الملتقى العربي للاستثمارات',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.95   },
  { ticker: 'BIGP',  yahoo: 'BIGP.CA',  nameEn: 'ElBarbary Investment Group',               nameAr: 'مجموعة البربري للاستثمار',               sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 0.35   },
  { ticker: 'CPME',  yahoo: 'CPME.CA',  nameEn: 'Catalyst Partners Middle East',            nameAr: 'كاتاليست بارتنرز الشرق الأوسط',         sector: 'Financial Services', industry: 'Investment Banking',      fallbackPrice: 15.35  },
  { ticker: 'IBCT',  yahoo: 'IBCT.CA',  nameEn: 'International Business Corp. for Trading & Agencies', nameAr: 'الشركة الدولية للأعمال والتجارة',       sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 13.39  },
  { ticker: 'KORA',  yahoo: 'KORA.CA',  nameEn: 'KORRA',                                    nameAr: 'كورة',                                   sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 3.39   },
  { ticker: 'MAAL',  yahoo: 'MAAL.CA',  nameEn: 'Marseilla Al Masreia Al Khalegeya for Holding Investment', nameAr: 'مرسيلا المصرية الخليجية للاستثمار',    sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 8.46   },

  // ─── Real Estate (35) ─────────────────────────────────────────────────────
  { ticker: 'TMGH',  yahoo: 'TMGH.CA',  nameEn: 'Talaat Moustafa Group Holding',            nameAr: 'طلعت مصطفى للتشييد والبناء',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 98.28  },
  { ticker: 'PHDC',  yahoo: 'PHDC.CA',  nameEn: 'Palm Hills Development Co.',                   nameAr: 'بالم هيلز للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 14.85  },
  { ticker: 'MASR',  yahoo: 'MASR.CA',  nameEn: 'Madinet Masr for Housing & Development',   nameAr: 'مدينة مصر للإسكان والتعمير',            sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.20   },
  { ticker: 'OCDI',  yahoo: 'OCDI.CA',  nameEn: 'Six of October Development & Investment (SODIC)',                                    nameAr: 'سوديك للتطوير العقاري',        sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 27.08  },
  { ticker: 'EMFD',  yahoo: 'EMFD.CA',  nameEn: 'Emaar Misr for Development SAE',               nameAr: 'إعمار مصر للتطوير العقاري',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 11.70  },
  { ticker: 'ORHD',  yahoo: 'ORHD.CA',  nameEn: 'Orascom Development Egypt (S.A.E)',               nameAr: 'أوراسكوم للتطوير مصر',                  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 39.20  },
  { ticker: 'HELI',  yahoo: 'HELI.CA',  nameEn: 'Heliopolis Housing',                        nameAr: 'مصر الجديدة للإسكان والتعمير',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.35   },
  { ticker: 'EGTS',  yahoo: 'EGTS.CA',  nameEn: 'Egyptian for Tourism Resorts',             nameAr: 'المجمعات السياحية المصرية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 18.20  },
  { ticker: 'AMER',  yahoo: 'AMER.CA',  nameEn: 'Amer Group Holding',                       nameAr: 'مجموعة عامر القابضة',                   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 3.16   },
  { ticker: 'UNIT',  yahoo: 'UNIT.CA',  nameEn: 'United Housing Construction SA',              nameAr: 'الاتحاد للإسكان والتعمير',              sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 19.06  },
  { ticker: 'ELSH',  yahoo: 'ELSH.CA',  nameEn: 'El-Shams Housing & Development SA',           nameAr: 'الشمس للإسكان والتعمير',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 14.60  },
  { ticker: 'EHDR',  yahoo: 'EHDR.CA',  nameEn: 'Egyptians Housing Development & Reconstruction', nameAr: 'مصر للإسكان والتعمير',           sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 2.67   },
  { ticker: 'IDRE',  yahoo: 'IDRE.CA',  nameEn: 'Ismailia Development & Real Estate Co.',       nameAr: 'الإسماعيلية الجديدة للتطوير العمراني', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 46.00  },
  { ticker: 'ZMID',  yahoo: 'ZMID.CA',  nameEn: 'Zahraa Maadi Investment & Development',   nameAr: 'زهراء المعادي للاستثمار والتعمير',      sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 7.26   },
  { ticker: 'RREI',  yahoo: 'RREI.CA',  nameEn: 'Arab Real Estate Investment Co.',          nameAr: 'الاتحاد العقاري المصري',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.84   },
  { ticker: 'MENA',  yahoo: 'MENA.CA',  nameEn: 'Mena Touristic & Real Estate Investment',  nameAr: 'مينا للاستثمار السياحي والعقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.05   },
  { ticker: 'RTVC',  yahoo: 'RTVC.CA',  nameEn: 'Remco for Touristic Villages Construction', nameAr: 'ريمكو للتجمعات السياحية',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 3.86   },
  { ticker: 'AREH',  yahoo: 'AREH.CA',  nameEn: 'Egyptian Real Estate Group',               nameAr: 'المجموعة المصرية للعقارات',             sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.71   },
  { ticker: 'BONY',  yahoo: 'BONY.CA',  nameEn: 'Bonyan for Development and Trade',         nameAr: 'بنيان للتطوير والتجارة',                sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 4.83   },
  { ticker: 'CCRS',  yahoo: 'CCRS.CA',  nameEn: 'Gulf Canadian Real Estate Investment Co.',     nameAr: 'الخليج الكندي للاستثمار العقاري',       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.54   },
  { ticker: 'CRST',  yahoo: 'CRST.CA',  nameEn: 'Creast Mark For Contracting And Real Estate Development',  nameAr: 'كريست مارك للمقاولات والتطوير العقاري', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.57   },
  { ticker: 'EGREF', yahoo: 'EGREF.CA', nameEn: 'Egyptians Real Estate Fund',               nameAr: 'الصندوق المصري للعقارات',               sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 13.78  },
  { ticker: 'ELKA',  yahoo: 'ELKA.CA',  nameEn: 'El Kahera Housing',                        nameAr: 'القاهرة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.64   },
  { ticker: 'ELWA',  yahoo: 'ELWA.CA',  nameEn: 'Elwadi for International Investment & Development', nameAr: 'الوادي للاستثمار الدولي',          sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 2.09   },
  { ticker: 'FIRE',  yahoo: 'FIRE.CA',  nameEn: 'First Investment & Real Estate Development', nameAr: 'الأولى للاستثمار والتطوير العقاري',   sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.45   },
  { ticker: 'GIHD',  yahoo: 'GIHD.CA',  nameEn: 'Gharbia Islamic Housing Development',      nameAr: 'الغربية الإسلامية للإسكان والتعمير',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 49.61  },
  { ticker: 'GPIM',  yahoo: 'GPIM.CA',  nameEn: 'GPI For Urban Growth',                     nameAr: 'جي بي آي للنمو العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 1.15   },
  { ticker: 'GPPL',  yahoo: 'GPPL.CA',  nameEn: 'Golden Pyramids Plaza',                    nameAr: 'هضبة الأهرام بلازا',                    sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 1.40   },
  { ticker: 'ICID',  yahoo: 'ICID.CA',  nameEn: 'International Company for Investment & Development', nameAr: 'الشركة الدولية للاستثمار والتنمية', sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.26 },
  { ticker: 'MMHC',  yahoo: 'MMHC.CA',  nameEn: 'El Mamoura Co For Egp10',                           nameAr: 'المعمورة للإسكان',                       sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 10.00  },
  { ticker: 'NARE',  yahoo: 'NARE.CA',  nameEn: 'Naeem Real Estate Holding Group',          nameAr: 'نعيم للاستثمار العقاري',                sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 19.52  },
  { ticker: 'NHPS',  yahoo: 'NHPS.CA',  nameEn: 'National Housing for Professional Syndicates', nameAr: 'الوطنية للإسكان للنقابات المهنية',  sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 83.54  },
  { ticker: 'OBRI',  yahoo: 'OBRI.CA',  nameEn: 'El Obour Real Estate Investment',          nameAr: 'العبور للاستثمار العقاري',              sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 36.45  },
  { ticker: 'PRDC',  yahoo: 'PRDC.CA',  nameEn: 'Pioneers Properties for Urban Development', nameAr: 'رواد للتطوير العمراني',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 8.20   },
  { ticker: 'TANM',  yahoo: 'TANM.CA',  nameEn: 'Tanmiya for Real Estate Investment',       nameAr: 'تنمية للاستثمار العقاري',               sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 5.83   },
  { ticker: 'UEGC',  yahoo: 'UEGC.CA',  nameEn: 'El-Saeed Contracting & Real Estate Investment Co. SCCD', nameAr: 'السعيد للمقاولات والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',          fallbackPrice: 1.91   },
  { ticker: 'UTOP',  yahoo: 'UTOP.CA',  nameEn: 'Utopia Real Estate Investment & Tourism SAE',  nameAr: 'يوتوبيا للاستثمار العقاري والسياحي',    sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 83.95  },
  { ticker: 'ADRI',  yahoo: 'ADRI.CA',  nameEn: 'Arab Development & Real Estate Investment', nameAr: 'العربية للتنمية والاستثمار العقاري',   sector: 'Real Estate', industry: 'Real Estate',             fallbackPrice: 7.18   },
  { ticker: 'GGCC',  yahoo: 'GGCC.CA',  nameEn: 'Giza General Contracting & Real Estate Investment',   nameAr: 'الجيزة للمقاولات العامة والاستثمار العقاري', sector: 'Real Estate', industry: 'Real Estate',      fallbackPrice: 0.59   },
  { ticker: 'COPR',  yahoo: 'COPR.CA',  nameEn: 'Cooper for Commercial Investment & Real Estate Development', nameAr: 'كوبر للاستثمار التجاري والعقاري', sector: 'Real Estate', industry: 'Real Estate',            fallbackPrice: 0.37   },
  { ticker: 'AFDI',  yahoo: 'AFDI.CA',  nameEn: 'Alahly For Development & Investment',      nameAr: 'الأهلي للتنمية والاستثمار',             sector: 'Real Estate', industry: 'Real Estate Development', fallbackPrice: 47.44  },

  // ─── Hotels & Tourism (11) ────────────────────────────────────────────────
  { ticker: 'EGOTH', yahoo: 'EGOTH.CA', nameEn: 'El Masreyah Touris Egp100',                      nameAr: 'المصرية للسياحة',                       sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 100.00 },
  { ticker: 'EITP',  yahoo: 'EITP.CA',  nameEn: 'Egyptian International Tourism Projects',  nameAr: 'مشروعات السياحة الدولية المصرية',       sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 8.17   },
  { ticker: 'MHOT',  yahoo: 'MHOT.CA',  nameEn: 'Misr Hotels Co.',                              nameAr: 'مصر للفنادق',                           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 16.44  },
  { ticker: 'MITR',  yahoo: 'MITR.CA',  nameEn: 'Misr Travel&Touris Egp6',                              nameAr: 'مصر للسفر والسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 6.00   },
  { ticker: 'MMAT',  yahoo: 'MMAT.CA',  nameEn: 'Marsa Marsa Alam for Tourism Development',           nameAr: 'مرسى علم للتطوير السياحي',              sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 3.70   },
  { ticker: 'PHTV',  yahoo: 'PHTV.CA',  nameEn: 'Pyramisa Hotels',                          nameAr: 'فنادق بيراميسا',                        sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 298.84 },
  { ticker: 'RMTV',  yahoo: 'RMTV.CA',  nameEn: 'Rowad Misr Tourism Investment',            nameAr: 'رواد مصر للاستثمار السياحي',            sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 100.00 },
  { ticker: 'ROTO',  yahoo: 'ROTO.CA',  nameEn: 'Rowad Tourism (Al Rowad) Co',                        nameAr: 'الرواد للسياحة',                        sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 43.07  },
  { ticker: 'SDTI',  yahoo: 'SDTI.CA',  nameEn: 'Sharm Dreams Co. for Tourism Investment',          nameAr: 'أحلام شرم للاستثمار السياحي',           sector: 'Hotels & Tourism', industry: 'Hotels',         fallbackPrice: 47.05  },
  { ticker: 'SPHT',  yahoo: 'SPHT.CA',  nameEn: 'El Shams Pyramids Co. for Hotels & Touristic Projects SAE',       nameAr: 'الشمس والأهرامات للفنادق والمشاريع السياحية', sector: 'Hotels & Tourism', industry: 'Hotels', fallbackPrice: 1.91   },
  { ticker: 'TRTO',  yahoo: 'TRTO.CA',  nameEn: 'TransOceans Tours',                        nameAr: 'ترانس أوشن للسياحة',                    sector: 'Hotels & Tourism', industry: 'Tourism',        fallbackPrice: 0.03   },

  // ─── Telecommunications (2) ───────────────────────────────────────────────
  { ticker: 'ETEL',  yahoo: 'ETEL.CA',  nameEn: 'Telecom Egypt',                            nameAr: 'المصرية للاتصالات',                     sector: 'Telecommunications', industry: 'Fixed Line Telecoms', fallbackPrice: 97.00 },
  { ticker: 'GTHE',  yahoo: 'GTHE.CA',  nameEn: 'Global Telecom Holding S.A.E.',                   nameAr: 'إيرثلينك للاتصالات القابضة',                sector: 'Telecommunications', industry: 'Mobile Telecoms',     fallbackPrice: 3.40  },

  // ─── Industrial (31) ──────────────────────────────────────────────────────
  { ticker: 'SWDY',  yahoo: 'SWDY.CA',  nameEn: 'El Sewedy Electric Company',                       nameAr: 'السويدي إليكتريك',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 88.47  },
  { ticker: 'EAST',  yahoo: 'EAST.CA',  nameEn: 'Eastern Company',                          nameAr: 'الشركة الشرقية للدخان',                 sector: 'Industrial', industry: 'Tobacco',                    fallbackPrice: 36.47  },
  { ticker: 'ORAS',  yahoo: 'ORAS.CA',  nameEn: 'Orascom Construction Plc',                     nameAr: 'أوراسكوم للإنشاء والصناعة',             sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 682.01 },
  { ticker: 'MOIL',  yahoo: 'MOIL.CA',  nameEn: 'Maridive & Oil Services SAE',                  nameAr: 'ماريديف والنفط للخدمات',                sector: 'Industrial', industry: 'Oil Services',               fallbackPrice: 0.55   },
  { ticker: 'EGAL',  yahoo: 'EGAL.CA',  nameEn: 'Egypt Aluminum',                           nameAr: 'مصر للألومنيوم',                        sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 291.40 },
  { ticker: 'ALUM',  yahoo: 'ALUM.CA',  nameEn: 'Arab Aluminum Co. SAE',                            nameAr: 'العربية للألومنيوم',                    sector: 'Industrial', industry: 'Aluminum',                   fallbackPrice: 22.81  },
  { ticker: 'MPRC',  yahoo: 'MPRC.CA',  nameEn: 'Egyptian Media Production City',           nameAr: 'مدينة الإنتاج الإعلامي',               sector: 'Industrial', industry: 'Media & Entertainment',      fallbackPrice: 42.16  },
  { ticker: 'ENGC',  yahoo: 'ENGC.CA',  nameEn: 'Industrial Engineering Co. for Construction & Development', nameAr: 'الصناعات الهندسية إيديال',          sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 41.54  },
  { ticker: 'ASCM',  yahoo: 'ASCM.CA',  nameEn: 'ASEC Co. for Mining',                  nameAr: 'أسيك للتعدين أسكوم',                    sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 62.12  },
  { ticker: 'COSG',  yahoo: 'COSG.CA',  nameEn: 'Cairo Oils & Soap',                        nameAr: 'القاهرة للزيوت والصابون',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 1.67   },
  { ticker: 'EEII',  yahoo: 'EEII.CA',  nameEn: 'El Arabia Engineering Industries',         nameAr: 'العربية للصناعات الهندسية',             sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 2.78   },
  { ticker: 'ACFR',  yahoo: 'ACFR.CA',  nameEn: 'Alexandria Company For Refractories',      nameAr: 'الإسكندرية للحراريات',                  sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'ANCC',  yahoo: 'ANCC.CA',  nameEn: 'ALNAHDA Industrial Co.',                   nameAr: 'النهضة للصناعات الوطنية',               sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'ARVA',  yahoo: 'ARVA.CA',  nameEn: 'Arab Valves Co.',                              nameAr: 'العربية للصمامات الصناعية',             sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.72  },
  { ticker: 'ATQA',  yahoo: 'ATQA.CA',  nameEn: 'Misr National Steel',                      nameAr: 'مصر الوطنية للصلب',                     sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 9.59   },
  { ticker: 'DTPP',  yahoo: 'DTPP.CA',  nameEn: 'Delta for Printing & Packaging',           nameAr: 'دلتا للطباعة والتغليف',                 sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 207.52 },
  { ticker: 'ELEC',  yahoo: 'ELEC.CA',  nameEn: 'Electro Cable Egypt',                      nameAr: 'إليكترو كابل مصر',                      sector: 'Industrial', industry: 'Electrical Equipment',       fallbackPrice: 2.16   },
  { ticker: 'EPPK',  yahoo: 'EPPK.CA',  nameEn: 'El Ahram Co. for Printing & Packing',          nameAr: 'الأهرام للطباعة والتغليف',              sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 14.08  },
  { ticker: 'IRON',  yahoo: 'IRON.CA',  nameEn: 'Egyptian Iron & Steel',                    nameAr: 'الحديد والصلب المصرية',                 sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 32.04  },
  { ticker: 'IRAX',  yahoo: 'IRAX.CA',  nameEn: 'El Ezz Aldekhela Steel-Alexandria',        nameAr: 'عز الدخيلة للصلب الإسكندرية',           sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 1245.00},
  { ticker: 'ISMQ',  yahoo: 'ISMQ.CA',  nameEn: 'Iron & Steel for Mines & Quarries',        nameAr: 'الحديد والصلب للمناجم والمحاجر',        sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 9.55   },
  { ticker: 'MBEG',  yahoo: 'MBEG.CA',  nameEn: 'MB for Engineering & Contracting',         nameAr: 'إم بي للمقاولات والهندسة',              sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 4.16   },
  { ticker: 'MISR',  yahoo: 'MISR.CA',  nameEn: 'MISR Intercontinental for Granite & Marble', nameAr: 'مصر إنتركونتيننتال للجرانيت والرخام', sector: 'Industrial', industry: 'Diversified Industrials',   fallbackPrice: 5.78   },
  { ticker: 'NCCW',  yahoo: 'NCCW.CA',  nameEn: 'Nasr Co. for Civil Works',                 nameAr: 'النصر للأعمال المدنية',                 sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 6.63   },
  { ticker: 'NMIN',  yahoo: 'NMIN.CA',  nameEn: 'El Nasr Mining Co Egp10',                           nameAr: 'النصر للتعدين',                         sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 10.00  },
  { ticker: 'RAKT',  yahoo: 'RAKT.CA',  nameEn: 'Rakta Paper Manufacturing',                nameAr: 'راكتا للورق',                           sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 23.00  },
  { ticker: 'UNIP',  yahoo: 'UNIP.CA',  nameEn: 'Universal Co. for Paper & Packaging Materials-Unipack',           nameAr: 'الوحدة للأوراق والكرتون',               sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 0.34   },
  { ticker: 'SMPP',  yahoo: 'SMPP.CA',  nameEn: 'Modern Shorouk Printing & Packaging',      nameAr: 'الشروق الحديثة للطباعة والتغليف',       sector: 'Industrial', industry: 'Packaging & Containers',     fallbackPrice: 115.00 },
  { ticker: 'SINA',  yahoo: 'SINA.CA',  nameEn: 'Sinai Manganese Company',                  nameAr: 'شركة سيناء للمنجنيز',                   sector: 'Industrial', industry: 'Mining',                     fallbackPrice: 15.00  },
  { ticker: 'IEEC',  yahoo: 'IEEC.CA',  nameEn: 'Industrial & Engineering Enterprises Co.',     nameAr: 'المؤسسات الصناعية والهندسية',           sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.59   },
  { ticker: 'CFGH',  yahoo: 'CFGH.CA',  nameEn: 'Concrete Fashion Group for Commercial and Industrial Investments S.A.E',                   nameAr: 'كونكريت فاشون للاستثمارات التجارية والصناعية',       sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.11   },
  { ticker: 'MTIE',  yahoo: 'MTIE.CA',  nameEn: 'MM Group for Industry & International Trade', nameAr: 'مجموعة إم إم للصناعة والتجارة الدولية', sector: 'Industrial', industry: 'Diversified Industrials', fallbackPrice: 9.73   },
  { ticker: 'FNAR',  yahoo: 'FNAR.CA',  nameEn: 'Al Fanar Contracting Construction Trade Import & Export Co.',      nameAr: 'الفنار للمقاولات والإنشاءات',           sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 12.26  },
  { ticker: 'GDWA',  yahoo: 'GDWA.CA',  nameEn: 'Gadwa For Industrial Development',         nameAr: 'جدوى للتنمية الصناعية',                 sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 0.84   },
  { ticker: 'GMCI',  yahoo: 'GMCI.CA',  nameEn: 'GMC Group for Industrial Commercial & Financial Investments',    nameAr: 'مجموعة جي إم سي للصناعة والتجارة',      sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 2.00   },
  { ticker: 'YAYT',  yahoo: 'YAYT.CA',  nameEn: 'Spring & Transportation Needs Manufacturing Co.', nameAr: 'الينابيع لصناعة مستلزمات النقل',    sector: 'Industrial', industry: 'Diversified Industrials',    fallbackPrice: 10.00  },
  { ticker: 'EFAC',  yahoo: 'EFAC.CA',  nameEn: 'Egyptian Ferro All Egp10',                    nameAr: 'المصرية لسبائك الحديد',              sector: 'Industrial', industry: 'Metals & Mining',            fallbackPrice: 10.00  },
  { ticker: 'DCRC',  yahoo: 'DCRC.CA',  nameEn: 'Delta Construction & Rebuilding Co.',          nameAr: 'دلتا للإنشاء وإعادة البناء',            sector: 'Industrial', industry: 'Construction & Engineering', fallbackPrice: 50.00  },

  // ─── Chemicals & Fertilizers (12) ─────────────────────────────────────────
  { ticker: 'ABUK',  yahoo: 'ABUK.CA',  nameEn: 'Abou Kir Fertilizers & Chemical Industries Co.', nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 69.05  },
  { ticker: 'SKPC',  yahoo: 'SKPC.CA',  nameEn: 'Sidi Kerir Petrochemicals',               nameAr: 'سيدي كرير للبتروكيماويات',               sector: 'Chemicals & Fertilizers', industry: 'Petrochemicals',   fallbackPrice: 16.40  },
  { ticker: 'MFPC',  yahoo: 'MFPC.CA',  nameEn: 'Misr Fertilizers Production Company MOPCO',     nameAr: 'موبكو لإنتاج الأسمدة',                   sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 37.10  },
  { ticker: 'EGCH',  yahoo: 'EGCH.CA',  nameEn: 'Egyptian Chemical Industries',     nameAr: 'الصناعات الكيماوية المصرية كيما',        sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 13.13  },
  { ticker: 'PACH',  yahoo: 'PACH.CA',  nameEn: 'Paints & Chemical Industries Co.',                nameAr: 'باتشين للدهانات المصرية',                 sector: 'Chemicals & Fertilizers', industry: 'Paints & Coatings', fallbackPrice: 80.00 },
  { ticker: 'MICH',  yahoo: 'MICH.CA',  nameEn: 'Misr Chemical Industries Ltd.',               nameAr: 'مصر للصناعات الكيماوية',                 sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 38.00  },
  { ticker: 'SMFR',  yahoo: 'SMFR.CA',  nameEn: 'Samad Misr-EGYFERT',                   nameAr: 'صامد مصر للأسمدة',                       sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 206.33 },
  { ticker: 'KZPC',  yahoo: 'KZPC.CA',  nameEn: 'Kafr El Zayat Pesticides & Chemical Co.',    nameAr: 'كفر الزيات للمبيدات والمواد الكيماوية',  sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 8.64   },
  { ticker: 'NFCI',  yahoo: 'NFCI.CA',  nameEn: 'ELNASR Co For Fertilizers And Chemical Industries',  nameAr: 'النصر للأسمدة والصناعات الكيماوية',      sector: 'Chemicals & Fertilizers', industry: 'Fertilizers',      fallbackPrice: 10.00  },
  { ticker: 'ELAB',  yahoo: 'ELAB.CA',  nameEn: 'The Egyptian Linear Alkyl Benzene co.-ELAB',   nameAr: 'المصرية للألكيل بنزين الخطي',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 0.10   },
  { ticker: 'CID',   yahoo: 'CID.CA',   nameEn: 'Chemical Dev Ind Egp10',      nameAr: 'الكيماويات والتنمية الصناعية',            sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 10.00  },
  { ticker: 'MOSC',  yahoo: 'MOSC.CA',  nameEn: 'Misr Oils & Soap Co.',                       nameAr: 'مصر للزيوت والصابون',                    sector: 'Chemicals & Fertilizers', industry: 'Chemicals',        fallbackPrice: 297.11 },

  // ─── Energy (8) ───────────────────────────────────────────────────────────
  { ticker: 'AMOC',  yahoo: 'AMOC.CA',  nameEn: 'Alexandria Mineral Oils Co.',         nameAr: 'الإسكندرية لزيوت المعادن',             sector: 'Energy', industry: 'Oil Refining',         fallbackPrice: 8.05   },
  { ticker: 'INEG',  yahoo: 'INEG.CA',  nameEn: 'Integrated Engineering Group S.A.E',            nameAr: 'المجموعة الهندسية المتكاملة',            sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.45   },
  { ticker: 'NDRL',  yahoo: 'NDRL.CA',  nameEn: 'National Drilling Co.',               nameAr: 'الشركة القومية للحفر',                   sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 4.69   },
  { ticker: 'PMSC',  yahoo: 'PMSC.CA',  nameEn: 'Petroleum Marine Services Co .P.M.S',               nameAr: 'خدمات النفط البحرية',                    sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 10.00  },
  { ticker: 'TAQA',  yahoo: 'TAQA.CA',  nameEn: 'TAQA Arabia',                             nameAr: 'طاقة العربية',                           sector: 'Energy', industry: 'Diversified Energy',   fallbackPrice: 14.87  },
  { ticker: 'EGAS',  yahoo: 'EGAS.CA',  nameEn: 'Egypt Gas Co.',                           nameAr: 'مصر للغاز',                             sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 53.47  },
  { ticker: 'ENPI',  yahoo: 'ENPI.CA',  nameEn: 'Engineering for the Petroleum and Process Industries-Enppi',        nameAr: 'الهندسة البترولية إنبي',                 sector: 'Energy', industry: 'Oil Services',         fallbackPrice: 0.13   },
  { ticker: 'GSSC',  yahoo: 'GSSC.CA',  nameEn: 'General Silos & Storage Co.',                 nameAr: 'الشركة العامة للصوامع والتخزين',         sector: 'Energy', industry: 'Gas Distribution',     fallbackPrice: 261.44 },

  // ─── Construction Materials (17) ──────────────────────────────────────────
  { ticker: 'SUCE',  yahoo: 'SUCE.CA',  nameEn: 'Suez Cement Co.',                             nameAr: 'أسمنت السويس',                          sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.00  },
  { ticker: 'MCQE',  yahoo: 'MCQE.CA',  nameEn: 'Misr Cement Co. (Qena)',                      nameAr: 'أسمنت مصر قنا',                         sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 177.00 },
  { ticker: 'LCSW',  yahoo: 'LCSW.CA',  nameEn: 'Lecico Egypt SAE',                            nameAr: 'ليسيكو مصر للسيراميك',                  sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 31.41  },
  { ticker: 'CERA',  yahoo: 'CERA.CA',  nameEn: 'Arab Ceramic Co. - Ceramica Remas',       nameAr: 'العربية للسيراميك سيراميكا ريماس',       sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 1.32   },
  { ticker: 'SCEM',  yahoo: 'SCEM.CA',  nameEn: 'Sinai Cement Co.',                            nameAr: 'أسمنت سيناء',                           sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 62.32  },
  { ticker: 'SVCE',  yahoo: 'SVCE.CA',  nameEn: 'South Valley Cement Co.',                     nameAr: 'أسمنت وادي النيل',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 9.40   },
  { ticker: 'ARCC',  yahoo: 'ARCC.CA',  nameEn: 'Arabian Cement Company',                  nameAr: 'الأسمنت العربي',                        sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 55.17  },
  { ticker: 'ALEX',  yahoo: 'ALEX.CA',  nameEn: 'Alexandria Cement Co.',                       nameAr: 'أسمنت الإسكندرية',                      sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 19.30  },
  { ticker: 'MBSC',  yahoo: 'MBSC.CA',  nameEn: 'Misr Beni Suef Cement Co. SAE',                   nameAr: 'مصر بني سويف للأسمنت',                  sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 240.04 },
  { ticker: 'TORA',  yahoo: 'TORA.CA',  nameEn: 'Tourah Cement Co',                           nameAr: 'أسمنت طرة',                             sector: 'Construction Materials', industry: 'Cement',            fallbackPrice: 68.20  },
  { ticker: 'ECAP',  yahoo: 'ECAP.CA',  nameEn: 'El Ezz Ceramics & Porcelain Co. (Gemma)',     nameAr: 'عز للسيراميك والبورسلين جيما',          sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 32.68  },
  { ticker: 'MEGM',  yahoo: 'MEGM.CA',  nameEn: 'Middle East Glass Manufacturing SAE',         nameAr: 'الشرق الأوسط لصناعة الزجاج',           sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 12.54  },
  { ticker: 'PRCL',  yahoo: 'PRCL.CA',  nameEn: 'General Co. for Ceramic & Porcelain Products',    nameAr: 'الشركة العامة للسيراميك والبورسلين',     sector: 'Construction Materials', industry: 'Ceramics & Tiles',  fallbackPrice: 34.90  },
  { ticker: 'RUBX',  yahoo: 'RUBX.CA',  nameEn: 'Rubex International for Plastic & Acrylic Manufacturing', nameAr: 'روبكس الدولية للبلاستيك والأكريليك', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 13.20  },
  { ticker: 'WATP',  yahoo: 'WATP.CA',  nameEn: 'Modern Co. for Water Proofing',           nameAr: 'الحديثة للعزل المائي والحراري',         sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 24.00  },
  { ticker: 'SIEG',  yahoo: 'SIEG.CA',  nameEn: 'Egyptian Company for Pipes and Cement Products -Siegwart', nameAr: 'المصرية للأنابيب ومنتجات الأسمنت سيغوارت', sector: 'Construction Materials', industry: 'Building Products', fallbackPrice: 10.00 },
  { ticker: 'KNGC',  yahoo: 'KNGC.CA',  nameEn: 'EL- Nasr Glass And Crystal',               nameAr: 'النصر للزجاج والبلور',                  sector: 'Construction Materials', industry: 'Glass',             fallbackPrice: 10.00  },

  // ─── Healthcare (19) ──────────────────────────────────────────────────────
  { ticker: 'CLHO',  yahoo: 'CLHO.CA',  nameEn: 'Cleopatra Hospital Company',                nameAr: 'مجموعة مستشفيات كليوباترا',             sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 16.07  },
  { ticker: 'PHAR',  yahoo: 'PHAR.CA',  nameEn: 'Egyptian International Pharmaceutical Industries Co.',                                  nameAr: 'الشركة المصرية الدولية للأدوية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 85.80  },
  { ticker: 'SPMD',  yahoo: 'SPMD.CA',  nameEn: 'Speed Medical SAE',                           nameAr: 'سبيد ميدكال للتشخيص',                   sector: 'Healthcare', industry: 'Diagnostics',         fallbackPrice: 0.45   },
  { ticker: 'RMDA',  yahoo: 'RMDA.CA',  nameEn: 'Tenth of Ramadan Pharmaceutical Industries & Diagnostic-Rameda',                   nameAr: 'راميدا للأدوية',                        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 4.97   },
  { ticker: 'ISPH',  yahoo: 'ISPH.CA',  nameEn: 'Ibnsina Pharma',                         nameAr: 'ابن سينا للأدوية والمستلزمات',          sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 11.47  },
  { ticker: 'ADCI',  yahoo: 'ADCI.CA',  nameEn: 'Arab Pharmaceuticals',                    nameAr: 'العربية للأدوية والصناعات الكيماوية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 236.44 },
  { ticker: 'AMES',  yahoo: 'AMES.CA',  nameEn: 'Alexandria New Medical Center Co.',           nameAr: 'مجمع الإسكندرية الطبي الجديد',          sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 100.66  },
  { ticker: 'APPC',  yahoo: 'APPC.CA',  nameEn: 'Advanced Pharmaceutical Packaging Co.',       nameAr: 'التعبئة الدوائية المتقدمة',             sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.34   },
  { ticker: 'AXPH',  yahoo: 'AXPH.CA',  nameEn: 'Alexandria Company for Pharmaceuticals and Chemical Industries',  nameAr: 'الإسكندرية للأدوية والصناعات الكيماوية',  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1205.55},
  { ticker: 'BIOC',  yahoo: 'BIOC.CA',  nameEn: 'GlaxoSmithKline S.A.E.',                   nameAr: 'جلاكسو سميث كلاين مصر',                sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 74.79  },
  { ticker: 'FCMD',  yahoo: 'FCMD.CA',  nameEn: 'Future Care For Medical Industries',      nameAr: 'المستقبل للصناعات الطبية',              sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 6.66   },
  { ticker: 'MCRO',  yahoo: 'MCRO.CA',  nameEn: 'Macro Group Pharmaceutical S.A.E.',              nameAr: 'ماكرو جروب للأدوية',                    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 1.35   },
  { ticker: 'MEPA',  yahoo: 'MEPA.CA',  nameEn: 'Medical Packaging Company',                   nameAr: 'التغليف الطبي',                         sector: 'Healthcare', industry: 'Medical Devices',     fallbackPrice: 1.66   },
  { ticker: 'MIPH',  yahoo: 'MIPH.CA',  nameEn: 'Minapharm Pharmaceuticals',               nameAr: 'منا فارم للصناعات الدوائية',            sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 707.19 },
  { ticker: 'MPCI',  yahoo: 'MPCI.CA',  nameEn: 'Memphis Pharmaceutical & Chemical Industries',       nameAr: 'ممفيس للصناعات الدوائية والكيماوية',    sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 240.47 },
  { ticker: 'NIPH',  yahoo: 'NIPH.CA',  nameEn: 'El-Nile Co. for Pharmaceuticals & Chemical Industries',      nameAr: 'النيل للأدوية والصناعات الكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 176.21 },
  { ticker: 'OCPH',  yahoo: 'OCPH.CA',  nameEn: 'October Pharma Co.',                          nameAr: 'أكتوبر فارما للأدوية',                  sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 366.34 },
  { ticker: 'SIPC',  yahoo: 'SIPC.CA',  nameEn: 'Sabaa International Company for Pharmaceutial and Chemical Industry',  nameAr: 'سبأ الدولية للصناعات الدوائية',         sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 3.52   },
  { ticker: 'UPMS',  yahoo: 'UPMS.CA',  nameEn: 'Union Pharmacist Company For Medical Services And Investment',   nameAr: 'اتحاد الصيادلة للخدمات الطبية',        sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 12.95  },
  { ticker: 'NINH',  yahoo: 'NINH.CA',  nameEn: 'Nozha International Hospital',            nameAr: 'مستشفى النزهة الدولي',                  sector: 'Healthcare', industry: 'Hospitals',           fallbackPrice: 17.99  },
  { ticker: 'CPCI',  yahoo: 'CPCI.CA',  nameEn: 'Kahira Pharmaceuticals & Chemical Industries Co.',       nameAr: 'القاهرة للصناعات الدوائية والكيماوية',     sector: 'Healthcare', industry: 'Pharmaceuticals',     fallbackPrice: 449.86 },

  // ─── Food & Beverage (28) ─────────────────────────────────────────────────
  { ticker: 'JUFO',  yahoo: 'JUFO.CA',  nameEn: 'Juhayna Food Industries',                 nameAr: 'جهينة للأغذية والألبان',                sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 30.50  },
  { ticker: 'DOMT',  yahoo: 'DOMT.CA',  nameEn: 'Arabian Food Industries Co.',          nameAr: 'الشركة العربية لصناعات الأغذية دومتي', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 27.04  },
  { ticker: 'EFID',  yahoo: 'EFID.CA',  nameEn: 'Edita Food Industries SAE',                   nameAr: 'أديتا للصناعات الغذائية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 28.38  },
  { ticker: 'POUL',  yahoo: 'POUL.CA',  nameEn: 'Cairo Poultry Co.',                     nameAr: 'القاهرة للدواجن',                       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 39.57  },
  { ticker: 'AJWA',  yahoo: 'AJWA.CA',  nameEn: 'Ajwa for Food Industries Co. Egypt',    nameAr: 'مجموعة أجواء للصناعات الغذائية',        sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 183.97 },
  { ticker: 'ISMA',  yahoo: 'ISMA.CA',  nameEn: 'Ismailia Misr Poultry',                  nameAr: 'الإسماعيلية مصر للدواجن',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 27.35  },
  { ticker: 'IFAP',  yahoo: 'IFAP.CA',  nameEn: 'International Agricultural Products',     nameAr: 'المنتجات الزراعية الدولية',             sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 19.67  },
  { ticker: 'OLFI',  yahoo: 'OLFI.CA',  nameEn: 'Obour Land for Food Industries',          nameAr: 'أرض العبور للصناعات الغذائية',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 22.99  },
  { ticker: 'INFI',  yahoo: 'INFI.CA',  nameEn: 'Ismailia National Food Industries',       nameAr: 'الإسماعيلية الوطنية للصناعات الغذائية', sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 103.64 },
  { ticker: 'SUGR',  yahoo: 'SUGR.CA',  nameEn: 'Delta Sugar',                             nameAr: 'دلتا للسكر',                            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 47.23  },
  { ticker: 'AFMC',  yahoo: 'AFMC.CA',  nameEn: 'Alexandria Flour Mills Co.',                  nameAr: 'مطاحن الإسكندرية',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 75.25  },
  { ticker: 'MILS',  yahoo: 'MILS.CA',  nameEn: 'North Cairo Mills Co.',                       nameAr: 'مطاحن شمال القاهرة',                    sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 137.71 },
  { ticker: 'SCFM',  yahoo: 'SCFM.CA',  nameEn: 'South Cairo & Giza Mills & Bakeries',                nameAr: 'مطاحن جنوب القاهرة والجيزة',           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 256.05 },
  { ticker: 'WCDF',  yahoo: 'WCDF.CA',  nameEn: 'Middle & West Delta Flour Mills Co.',         nameAr: 'مطاحن وسط وغرب الدلتا',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 525.00 },
  { ticker: 'UEFM',  yahoo: 'UEFM.CA',  nameEn: 'Upper Egypt Flour Mills Co.',                 nameAr: 'مطاحن الصعيد',                          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 500.00 },
  { ticker: 'EDFM',  yahoo: 'EDFM.CA',  nameEn: 'East Delta Flour Mills Co.',                  nameAr: 'مطاحن شرق الدلتا',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 354.39 },
  { ticker: 'CEFM',  yahoo: 'CEFM.CA',  nameEn: 'Middle Egypt Flour Mills',                nameAr: 'مطاحن وسط مصر',                         sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 104.98 },
  { ticker: 'SNFC',  yahoo: 'SNFC.CA',  nameEn: 'Sharkia National Food',                   nameAr: 'الشركية الوطنية للأغذية',               sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.80  },
  { ticker: 'SNFI',  yahoo: 'SNFI.CA',  nameEn: 'Souhag National Food Industries',         nameAr: 'سوهاج الوطنية للصناعات الغذائية',       sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 10.53  },
  { ticker: 'EPCO',  yahoo: 'EPCO.CA',  nameEn: 'Egypt for Poultry Co.',                   nameAr: 'مصر للدواجن',                           sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 9.70   },
  { ticker: 'MPCO',  yahoo: 'MPCO.CA',  nameEn: 'Mansourah Poultry Co.',                       nameAr: 'المنصورة للدواجن',                      sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 1.89   },
  { ticker: 'GOUR',  yahoo: 'GOUR.CA',  nameEn: 'Gourmet Egypt.Com Foods',                     nameAr: 'جورميه مصر للأغذية',                   sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 14.25  },
  { ticker: 'ZEOT',  yahoo: 'ZEOT.CA',  nameEn: 'Extracted Oils & Derivatives Co.',            nameAr: 'الزيوت المستخلصة ومشتقاتها',            sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 11.71  },
  { ticker: 'ADPC',  yahoo: 'ADPC.CA',  nameEn: 'Arab Dairy Products Co. Arab Dairy - Panda',              nameAr: 'منتجات الألبان العربية بانده',          sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 3.76   },
  { ticker: 'AIFI',  yahoo: 'AIFI.CA',  nameEn: 'Atlas for Investment & Food Industries SAE',  nameAr: 'أطلس للاستثمار والصناعات الغذائية',     sector: 'Food & Beverage', industry: 'Food Production',   fallbackPrice: 2.13   },
  { ticker: 'ELNA',  yahoo: 'ELNA.CA',  nameEn: 'El Nasr for Manufacturing Agricultural Crops', nameAr: 'النصر لتصنيع المحاصيل الزراعية',  sector: 'Food & Beverage', industry: 'Agriculture',       fallbackPrice: 39.47  },
  { ticker: 'MFSC',  yahoo: 'MFSC.CA',  nameEn: 'Misr Duty Free Shops Co.',                    nameAr: 'مصر للمحلات الحرة',                     sector: 'Food & Beverage', industry: 'Retail',            fallbackPrice: 45.71  },
  { ticker: 'KABO',  yahoo: 'KABO.CA',  nameEn: 'El Nasr Clothing & Textiles Co.',             nameAr: 'النصر للملابس والمنسوجات',              sector: 'Textile',         industry: 'Apparel',           fallbackPrice: 7.51   },

  // ─── Technology (10) ──────────────────────────────────────────────────────
  { ticker: 'FWRY',  yahoo: 'FWRY.CA',  nameEn: 'Fawry For Banking Technology And Electronic Payment', nameAr: 'فوري للبنوك والمدفوعات الإلكترونية', sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 19.30 },
  { ticker: 'EFIH',  yahoo: 'EFIH.CA',  nameEn: 'e-finance for Digital and Financial Investments S.A.E.',     nameAr: 'إي فاينانس للاستثمارات الرقمية والمالية',      sector: 'Technology', industry: 'Digital Finance',     fallbackPrice: 22.45 },
  { ticker: 'VERT',  yahoo: 'VERT.CA',  nameEn: 'Vertika for Industry & Trade',            nameAr: 'فيرتيكا للصناعة والتجارة',              sector: 'Technology', industry: 'Technology Services', fallbackPrice: 7.93   },
  { ticker: 'RACC',  yahoo: 'RACC.CA',  nameEn: 'Raya Contact Center',                     nameAr: 'رايا لخدمات مراكز الاتصال',             sector: 'Technology', industry: 'Technology Services', fallbackPrice: 10.48  },
  { ticker: 'AMPI',  yahoo: 'AMPI.CA',  nameEn: 'AL Moasher Pay for Electronic Payment and Collection (S.A.E)',   nameAr: 'المؤشر باي للمدفوعات الإلكترونية',      sector: 'Technology', industry: 'Payment Technology',  fallbackPrice: 2.80   },
  { ticker: 'DGTZ',  yahoo: 'DGTZ.CA',  nameEn: 'Digitize for Investment And Technology',    nameAr: 'ديجيتايز للاستثمار والتكنولوجيا',       sector: 'Technology', industry: 'Technology Services', fallbackPrice: 2.63   },
  { ticker: 'EGSA',  yahoo: 'EGSA.CA',  nameEn: 'Egyptian Satellite Co.',                  nameAr: 'الشركة المصرية للقمر الصناعي',          sector: 'Technology', industry: 'Satellite & Telecom', fallbackPrice: 8.95   },
  { ticker: 'SCTS',  yahoo: 'SCTS.CA',  nameEn: 'Sues Canal Co. for Technology Settling',  nameAr: 'قناة السويس للتكنولوجيا والتسويات',     sector: 'Technology', industry: 'Technology Services', fallbackPrice: 616.15 },
  { ticker: 'FTNS',  yahoo: 'FTNS.CA',  nameEn: 'Fitness Prime',                           nameAr: 'فيتنس برايم',                           sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.21   },
  { ticker: 'GEOS',  yahoo: 'GEOS.CA',  nameEn: 'Geos for trading and contracting',        nameAr: 'جيوس للتجارة والمقاولات',               sector: 'Technology', industry: 'Technology Services', fallbackPrice: 1.00   },

  // ─── Textile (9) ──────────────────────────────────────────────────────────
  { ticker: 'ORWE',  yahoo: 'ORWE.CA',  nameEn: 'Oriental Weavers Carpet',                 nameAr: 'الشرقية للسجاد',                        sector: 'Textile', industry: 'Carpets & Flooring',     fallbackPrice: 22.65  },
  { ticker: 'DSCW',  yahoo: 'DSCW.CA',  nameEn: 'Dice Sports & Casual Wear Manufacturers SAE',  nameAr: 'دايس للملابس الرياضية',                 sector: 'Textile', industry: 'Apparel',                fallbackPrice: 1.85   },
  { ticker: 'ACGC',  yahoo: 'ACGC.CA',  nameEn: 'Arab Cotton Ginning Co.',                     nameAr: 'العربية لحلج الأقطان',                  sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 10.01   },
  { ticker: 'APSW',  yahoo: 'APSW.CA',  nameEn: 'Arab Polvara Spinning & Weaving Co.',         nameAr: 'العربية بولفارة للغزل والنسيج',         sector: 'Textile', industry: 'Textiles',               fallbackPrice: 8.51   },
  { ticker: 'GTWL',  yahoo: 'GTWL.CA',  nameEn: 'Golden Textiles & Clothes Wool',          nameAr: 'الذهبية للمنسوجات والملابس والصوف',     sector: 'Textile', industry: 'Textiles',               fallbackPrice: 112.99 },
  { ticker: 'NCGC',  yahoo: 'NCGC.CA',  nameEn: 'Nile Cotton Ginning',                     nameAr: 'النيل لحلج الأقطان',                    sector: 'Textile', industry: 'Agriculture & Textiles', fallbackPrice: 51.00  },
  { ticker: 'SPIN',  yahoo: 'SPIN.CA',  nameEn: 'Alexandria Spinning & Weaving',           nameAr: 'الإسكندرية للغزل والنسيج',              sector: 'Textile', industry: 'Textiles',               fallbackPrice: 14.63  },
  { ticker: 'GTEX',  yahoo: 'GTEX.CA',  nameEn: 'G-TEX for Commercial and Industrial Investments S.A.E',     nameAr: 'جي تكس للاستثمارات التجارية والصناعية', sector: 'Textile', industry: 'Textiles',               fallbackPrice: 0.03   },

  // ─── Agriculture (7) ──────────────────────────────────────────────────────
  { ticker: 'AALR',  yahoo: 'AALR.CA',  nameEn: 'General Co. for Land Reclamation Development & Reconstruction',        nameAr: 'الشركة العامة لاستصلاح الأراضي',        sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 230.05 },
  { ticker: 'EALR',  yahoo: 'EALR.CA',  nameEn: 'El Arabia for Land Reclamation',          nameAr: 'العربية لاستصلاح الأراضي',              sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 369.95 },
  { ticker: 'GGRN',  yahoo: 'GGRN.CA',  nameEn: 'Gogreen for Agricultural Investment and Development Company',         nameAr: 'جو جرين للاستثمار والتنمية الزراعية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 1.45   },
  { ticker: 'KRDI',  yahoo: 'KRDI.CA',  nameEn: 'Al Khair River for Development Agriculture Investment and Environmental Services', nameAr: 'الخير للتنمية الزراعية والبيئية',   sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.35   },
  { ticker: 'LUTS',  yahoo: 'LUTS.CA',  nameEn: 'Lotus For Agricultural Investments And Development',          nameAr: 'لوتس للاستثمارات الزراعية',             sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 0.74   },
  { ticker: 'NEDA',  yahoo: 'NEDA.CA',  nameEn: 'Northern Upper Egypt Development & Agricultural Production', nameAr: 'شمال الصعيد للتنمية والإنتاج الزراعي', sector: 'Agriculture', industry: 'Agriculture', fallbackPrice: 2.79   },
  { ticker: 'WKOL',  yahoo: 'WKOL.CA',  nameEn: 'Wadi Kom Ombo Land Reclamation',          nameAr: 'وادي كوم أمبو لاستصلاح الأراضي',       sector: 'Agriculture', industry: 'Agriculture',         fallbackPrice: 315.00 },

  // ─── Missing from earlier — confirmed in TradingView scanner ─────────────
  { ticker: 'SAUD',  yahoo: 'SAUD.CA',  nameEn: 'Al Baraka Bank Egypt',                    nameAr: 'بنك البركة مصر',                        sector: 'Banking',            industry: 'Islamic Banking',       fallbackPrice: 21.54  },
  { ticker: 'ARAB',  yahoo: 'ARAB.CA',  nameEn: 'Arab Developers Holding',                 nameAr: 'العرب للتطوير العقاري القابضة',          sector: 'Real Estate',        industry: 'Real Estate Development', fallbackPrice: 0.25   },
  { ticker: 'DAPH',  yahoo: 'DAPH.CA',  nameEn: 'Development & Engineering Consultants',   nameAr: 'التنمية والاستشارات الهندسية',           sector: 'Financial Services', industry: 'Diversified Financials',  fallbackPrice: 84.00  },
  { ticker: 'HBCO',  yahoo: 'HBCO.CA',  nameEn: 'Heibco Npv',                                  nameAr: 'هيبكو',                                 sector: 'Industrial',         industry: 'Diversified Industrials', fallbackPrice: 13.40  },

  // ─── Insurance (3) ────────────────────────────────────────────────────────
  { ticker: 'DEIN',  yahoo: 'DEIN.CA',  nameEn: 'Delta Insurance',                         nameAr: 'دلتا للتأمين',                          sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 10.35  },
  { ticker: 'MOIN',  yahoo: 'MOIN.CA',  nameEn: 'Mohandes Insurance Co.',                      nameAr: 'المهندس للتأمين',                       sector: 'Insurance', industry: 'Insurance',            fallbackPrice: 23.98  },
  { ticker: 'MLIC',  yahoo: 'MLIC.CA',  nameEn: 'Misr Life Insurance',                     nameAr: 'مصر للتأمين على الحياة',                sector: 'Insurance', industry: 'Life Insurance',       fallbackPrice: 10.00  },

  // ─── Education (4) ────────────────────────────────────────────────────────
  { ticker: 'CIRA',  yahoo: 'CIRA.CA',  nameEn: 'Cairo For Investment And Real Estate Developments -CIRA Education',                          nameAr: 'سيرا للتعليم',                          sector: 'Education', industry: 'Education Services',   fallbackPrice: 31.37  },
  { ticker: 'CAED',  yahoo: 'CAED.CA',  nameEn: 'Cairo Educational Services',              nameAr: 'القاهرة للخدمات التعليمية',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 74.42  },
  { ticker: 'EEP',   yahoo: 'EEP.CA',   nameEn: 'Egypt Education Platform - EEP',                nameAr: 'المنصة المصرية للتعليم',                sector: 'Education', industry: 'Education Services',   fallbackPrice: 1.00   },
  { ticker: 'TALM',  yahoo: 'TALM.CA',  nameEn: 'Taaleem Management Services S.A.E',             nameAr: 'تعليم لإدارة الخدمات',                  sector: 'Education', industry: 'Education Services',   fallbackPrice: 15.72  },
  { ticker: 'MOED',  yahoo: 'MOED.CA',  nameEn: 'Egyptian Modern Education Systems',       nameAr: 'الأنظمة التعليمية الحديثة',             sector: 'Education', industry: 'Education Services',   fallbackPrice: 0.73   },

  // ─── Transportation (7) ───────────────────────────────────────────────────
  { ticker: 'ALCN',  yahoo: 'ALCN.CA',  nameEn: 'Alexandria Containers & Goods',   nameAr: 'الإسكندرية للحاويات والشحن',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 29.91  },
  { ticker: 'ETRS',  yahoo: 'ETRS.CA',  nameEn: 'Egyptian Transport And Commercial Services Co. (Egytrans Nosco)',            nameAr: 'مصر للنقل إيجيترانس',                   sector: 'Transportation', industry: 'Road Transport',   fallbackPrice: 10.79  },
  { ticker: 'CSAG',  yahoo: 'CSAG.CA',  nameEn: 'Canal Shipping Agencies Co.',                 nameAr: 'وكلاء الشحن بالقنال',                   sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 32.35  },
  { ticker: 'DCCC',  yahoo: 'DCCC.CA',  nameEn: 'Damietta Container and Cargo Handling',     nameAr: 'دمياط للحاويات والبضائع',               sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 10.00  },
  { ticker: 'POCO',  yahoo: 'POCO.CA',  nameEn: 'Port Said Container And Cargo Handling',    nameAr: 'بور سعيد للحاويات والبضائع',            sector: 'Transportation', industry: 'Marine Shipping',  fallbackPrice: 5.00   },
  { ticker: 'EGWA',  yahoo: 'EGWA.CA',  nameEn: 'General Warehouses of Egypt',             nameAr: 'المخازن العمومية المصرية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 5.00   },
  { ticker: 'BIDI',  yahoo: 'BIDI.CA',  nameEn: 'El Badr Investment and Development - BID',      nameAr: 'البدر للاستثمار والتنمية',              sector: 'Transportation', industry: 'Logistics',        fallbackPrice: 1.76   },

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
