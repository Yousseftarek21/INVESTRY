import { Router, type IRouter } from "express";
import { lt, desc, eq } from "drizzle-orm";
import { db, marketCloseSnapshotsTable, realEstatePricesTable, realEstateCompoundPricesTable } from "@workspace/db";
import { RE_PRICES, RE_COMPOUNDS } from "@workspace/shared-data";
import { logger } from "../lib/logger";
import { cairoDateString, tradingDayKey } from "../lib/cairoDate";
import { shariahScreeningReference } from "../lib/shariahScreening";

const router: IRouter = Router();

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number; }

function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (!entry || Date.now() - entry.ts > ttlMs) return null;
      return entry.data;
    },
    set(data: T) { entry = { data, ts: Date.now() }; },
  };
}

const pricesCache    = makeCache<MarketPricesResponse>(30_000);   // 30 s
const historicalCache = makeCache<HistoricalRates>(86_400_000);   // 24 h
const stocksCache    = makeCache<EGXStockResponse[]>(10_000);     // 10 s — matches useEGXMarket.ts's client poll; shorter than metals' 30s to compensate for the bigger 281-company scan taking longer to visibly refresh
const globalStocksCache = makeCache<EGXStockResponse[]>(5 * 60_000); // 5 min (Twelve Data free tier)
const egxIndicesCache = makeCache<EGXStockResponse[]>(30_000);    // 30 s
// Per-symbol, not one shared entry — a Map of independent 5-min caches.
// News doesn't move on a 10s clock like price does, so a much longer TTL is
// correct here, not just tolerable.
const stockNewsCaches = new Map<string, ReturnType<typeof makeCache<StockNewsItem[]>>>();
function stockNewsCache(symbol: string) {
  let c = stockNewsCaches.get(symbol);
  if (!c) { c = makeCache<StockNewsItem[]>(5 * 60_000); stockNewsCaches.set(symbol, c); }
  return c;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketPricesResponse {
  goldUsd: number;
  silverUsd: number;
  usdToEgp: number;
  usdToEgpChangePercent: number;
  goldChange: number;
  goldChangePercent: number;
  goldChangePercentEgp: number;
  silverChange: number;
  silverChangePercent: number;
  silverChangePercentEgp: number;
  goldEgpPerGram: Record<string, number>;
  silverEgpPerGram: number;
  fxRates: Record<string, number>;
  lastUpdated: string;
  sources: string[];
}

export interface EGXStockResponse {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  // Total interest-bearing debt, for the Shariah debt screen (AAOIFI: debt
  // must stay under ~33% of market cap). Absent for some tickers — the
  // screener treats missing as "can't screen", never as a pass.
  totalDebt?: number;
  // Is this row from a session that traded today, or is the exchange shut and
  // TradingView still serving the last one's bar? The client can't tell from
  // price/change alone once a stale change has been zeroed, and without it a
  // pulsing green LIVE dot kept claiming a closed market was trading.
  sessionLive?: boolean;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividendYield?: number;
  sector?: string;
  epsTtm?: number;
  revenueGrowthYoy?: number;
  netMargin?: number;
  roe?: number;
  debtToEquity?: number;
  priceToBook?: number;
  // Added for deeper per-stock financials — verified live against
  // TradingView's Egypt scanner (not guessed), same as every other column
  // here. Sparser than the core set above: several EGX tickers return null
  // for these even when the core set is populated, so all four stay
  // optional and the client already renders "—" for a missing field.
  currentRatio?: number;
  quickRatio?: number;
  returnOnAssets?: number;
  freeCashFlowTtm?: number;
  cashAndEquivalents?: number;
  employees?: number;
}

interface HistoricalRates {
  xauClose: number;
  xagClose: number;
  date: string;
}

// ─── EGX ticker list ──────────────────────────────────────────────────────────

// 279 verified EGX companies — sourced from TradingView Egypt scanner (all active stocks with live prices).
// Kept in sync with artifacts/mobile/data/egx-companies.ts
// ESRS (Ezz Steel) removed — absent from TradingView scanner, no live data available.
const EGX_TICKERS = [
  // Banking (13)
  { symbol: "COMI",   name: "Commercial International Bank (CIB)"          },
  { symbol: "CIEB",   name: "Credit Agricole Egypt"                        },
  { symbol: "ADIB",   name: "Abu Dhabi Islamic Bank Egypt"                 },
  { symbol: "HDBK",   name: "Housing & Development Bank"                   },
  { symbol: "QNBE",   name: "QNB Alahli"                                   },
  { symbol: "NBKE",   name: "National Bank of Kuwait Egypt"                },
  { symbol: "CANA",   name: "Suez Canal Bank"                              },
  { symbol: "SAIB",   name: "Societe Arabe Internationale de Banque"       },
  { symbol: "UBEE",   name: "United Bank"                                  },
  { symbol: "EXPA",   name: "Export Development Bank of Egypt"             },
  { symbol: "EGBE",   name: "Egyptian Gulf Bank"                           },
  { symbol: "FAIT",   name: "Faisal Islamic Bank of Egypt"                 },
  { symbol: "FAITA",  name: "Faisal Islamic Bank of Egypt (B Shares)"      },
  // Financial Services (47)
  { symbol: "HRHO",   name: "EFG Holding"                                  },
  { symbol: "CICH",   name: "CI Capital Holding"                           },
  { symbol: "EFIC",   name: "Egyptian Financial & Industrial Co."          },
  { symbol: "GBCO",   name: "GB Corp"                                      },
  { symbol: "CCAP",   name: "QALA For Financial Investments"               },
  { symbol: "BINV",   name: "B Investments Holding"                        },
  { symbol: "BTFH",   name: "Beltone Holding"                              },
  { symbol: "CNFN",   name: "Contact Financial Holding"                    },
  { symbol: "ACTF",   name: "Act Financial"                                },
  { symbol: "ASPI",   name: "Aspire Capital Holding"                       },
  { symbol: "ATLC",   name: "Al Tawfeek Leasing"                           },
  { symbol: "VALU",   name: "U Consumer Finance"                           },
  { symbol: "RAYA",   name: "Raya Holding for Financial Investments"       },
  { symbol: "ICLE",   name: "International Co. for Leasing"                },
  { symbol: "ICFC",   name: "International Co. for Fertilizers & Chemicals"},
  { symbol: "MKIT",   name: "Misr Kuwait Investment & Trading"             },
  { symbol: "KWIN",   name: "El Kahera El Watania Investment"               },
  { symbol: "NAHO",   name: "Naeem Holding"                                },
  { symbol: "ODIN",   name: "ODIN Investments"                             },
  { symbol: "OFH",    name: "OB Financial Holding"                         },
  { symbol: "OIH",    name: "Orascom Investment Holding"                   },
  { symbol: "PRMH",   name: "Prime Holding"                                },
  { symbol: "RKAZ",   name: "REKAZ Financial Holding"                      },
  { symbol: "TYCN",   name: "Tycoon Holding"                               },
  { symbol: "TWSA",   name: "TAWASOA For Factoring"                        },
  { symbol: "GRCA",   name: "Grand Investment Capital"                     },
  { symbol: "HAVC",   name: "Hassan Allam Investments & Venture Capital"   },
  { symbol: "LKGP",   name: "Lakah Group Holding"                          },
  { symbol: "SEIG",   name: "Saudi Egyptian Investment & Finance"          },
  { symbol: "SEIGA",  name: "Saudi Egyptian Investment & Finance (A)"      },
  { symbol: "VLMR",   name: "Valmore Holding"                              },
  { symbol: "VLMRA",  name: "Valmore Holding (A)"                          },
  { symbol: "OCAP",   name: "OG Capital For Investments"                   },
  { symbol: "EASB",   name: "Egyptian Arabian Securities Brokerage"        },
  { symbol: "EBSC",   name: "Osool ESB Securities Brokerage"               },
  { symbol: "EOSB",   name: "El Orouba Securities Brokerage"               },
  { symbol: "ACAMD",  name: "Arab Co. for Asset Management & Development"  },
  { symbol: "ACAP",   name: "A Capital Holding"                            },
  { symbol: "HDST",   name: "HEDGESTONE INVESTMENT"                        },
  { symbol: "AIDC",   name: "Arabia for Investment and Development"        },
  { symbol: "AIH",    name: "Arabia Investments Holding"                   },
  { symbol: "AMIA",   name: "Arab Moltaqa Investments"                     },
  { symbol: "BIGP",   name: "ElBarbary Investment Group"                   },
  { symbol: "CPME",   name: "Catalyst Partners Middle East"                },
  { symbol: "IBCT",   name: "International Business Corp. for Trading"     },
  { symbol: "KORA",   name: "KORRA"                                        },
  { symbol: "MAAL",   name: "Marseilla El Masreia El Khalegeya Holding"    },
  // Real Estate (41)
  { symbol: "TMGH",   name: "Talaat Moustafa Group Holding"                },
  { symbol: "PHDC",   name: "Palm Hills Development"                       },
  { symbol: "MASR",   name: "Madinet Masr for Housing & Development"       },
  { symbol: "OCDI",   name: "SODIC"                                        },
  { symbol: "EMFD",   name: "Emaar Misr for Development"                   },
  { symbol: "ORHD",   name: "Orascom Development Egypt"                    },
  { symbol: "HELI",   name: "Heliopolis Housing"                           },
  { symbol: "EGTS",   name: "Egyptian for Tourism Resorts"                 },
  { symbol: "AMER",   name: "Amer Group Holding"                           },
  { symbol: "UNIT",   name: "United Housing Construction"                  },
  { symbol: "ELSH",   name: "El Shams Housing & Development"               },
  { symbol: "EHDR",   name: "Egyptians Housing Development & Reconstruction"},
  { symbol: "IDRE",   name: "Ismailia Development & Real Estate"           },
  { symbol: "ZMID",   name: "Zahraa Maadi Investment & Development"        },
  { symbol: "RREI",   name: "Arab Real Estate Investment Co."              },
  { symbol: "MENA",   name: "Mena Touristic & Real Estate Investment"      },
  { symbol: "RTVC",   name: "Remco for Touristic Villages Construction"    },
  { symbol: "AREH",   name: "Egyptian Real Estate Group"                   },
  { symbol: "BONY",   name: "Bonyan for Development and Trade"             },
  { symbol: "CCRS",   name: "Gulf Canadian Real Estate Investment"         },
  { symbol: "CRST",   name: "Creast Mark for Real Estate Development"      },
  { symbol: "EGREF",  name: "Egyptians Real Estate Fund"                   },
  { symbol: "ELKA",   name: "El Kahera Housing"                            },
  { symbol: "ELWA",   name: "Elwadi International Investment & Development"},
  { symbol: "FIRE",   name: "First Investment & Real Estate Development"   },
  { symbol: "GIHD",   name: "Gharbia Islamic Housing Development"          },
  { symbol: "GPIM",   name: "GPI For Urban Growth"                         },
  { symbol: "GPPL",   name: "Golden Pyramids Plaza"                        },
  { symbol: "ICID",   name: "International Co. for Investment & Development"},
  { symbol: "MMHC",   name: "El Mamoura Co."                               },
  { symbol: "NARE",   name: "Naeem Real Estate Holding Group"              },
  { symbol: "NHPS",   name: "National Housing for Professional Syndicates" },
  { symbol: "OBRI",   name: "El Obour Real Estate Investment"              },
  { symbol: "PRDC",   name: "Pioneers Properties for Urban Development"    },
  { symbol: "TANM",   name: "Tanmiya for Real Estate Investment"           },
  { symbol: "UEGC",   name: "El-Saeed Contracting & Real Estate Investment"},
  { symbol: "UTOP",   name: "Utopia Real Estate Investment & Tourism"      },
  { symbol: "ADRI",   name: "Arab Development & Real Estate Investment"    },
  { symbol: "GGCC",   name: "Giza General Contracting & Real Estate"       },
  { symbol: "COPR",   name: "Cooper for Commercial Investment & Real Estate"},
  { symbol: "AFDI",   name: "Alahly For Development & Investment"          },
  // Hotels & Tourism (11)
  { symbol: "EGOTH",  name: "El Masreyah Tourism"                          },
  { symbol: "EITP",   name: "Egyptian International Tourism Projects"      },
  { symbol: "MHOT",   name: "Misr Hotels"                                  },
  { symbol: "MITR",   name: "Misr Travel"                                  },
  { symbol: "MMAT",   name: "Marsa Alam Tourism Development"               },
  { symbol: "PHTV",   name: "Pyramisa Hotels"                              },
  { symbol: "RMTV",   name: "Rowad Misr Tourism Investment"                },
  { symbol: "ROTO",   name: "Rowad Tourism Co."                            },
  { symbol: "SDTI",   name: "Sharm Dreams Tourism Investment"              },
  { symbol: "SPHT",   name: "El Shams Pyramids Hotels & Tourism"           },
  { symbol: "TRTO",   name: "TransOceans Tours"                            },
  // Telecommunications (2)
  { symbol: "ETEL",   name: "Telecom Egypt"                                },
  { symbol: "GTHE",   name: "Global Telecom Holding"                       },
  // Industrial (38)
  { symbol: "SWDY",   name: "El Sewedy Electric"                           },
  { symbol: "EAST",   name: "Eastern Company"                              },
  { symbol: "ORAS",   name: "Orascom Construction"                         },
  { symbol: "MOIL",   name: "Maridive & Oil Services"                      },
  { symbol: "EGAL",   name: "Egypt Aluminum"                               },
  { symbol: "ALUM",   name: "Arab Aluminum"                                },
  { symbol: "MPRC",   name: "Egyptian Media Production City"               },
  { symbol: "ENGC",   name: "Industrial Engineering Co. for Construction"  },
  { symbol: "ASCM",   name: "ASEC for Mining (Ascom)"                     },
  { symbol: "COSG",   name: "Cairo Oils & Soap"                            },
  { symbol: "EEII",   name: "El Arabia Engineering Industries"             },
  { symbol: "ACFR",   name: "Alexandria Company for Refractories"          },
  { symbol: "ANCC",   name: "ALNAHDA Industrial Co."                       },
  // ARVA (Arab Valves) removed — absent from TradingView scanner, no live data available.
  { symbol: "ATQA",   name: "Misr National Steel"                          },
  { symbol: "DTPP",   name: "Delta for Printing & Packaging"               },
  { symbol: "ELEC",   name: "Electro Cable Egypt"                          },
  { symbol: "EPPK",   name: "El Ahram for Printing & Packing"              },
  { symbol: "IRON",   name: "Egyptian Iron & Steel"                        },
  { symbol: "IRAX",   name: "El Ezz Aldekhela Steel-Alexandria"            },
  { symbol: "ISMQ",   name: "Iron & Steel for Mines & Quarries"            },
  { symbol: "MBEG",   name: "MB for Engineering & Contracting"             },
  { symbol: "MISR",   name: "MISR Intercontinental for Granite & Marble"   },
  { symbol: "NCCW",   name: "Nasr Co. for Civil Works"                     },
  { symbol: "NMIN",   name: "El Nasr Mining"                               },
  { symbol: "RAKT",   name: "Rakta Paper Manufacturing"                    },
  { symbol: "UNIP",   name: "Universal For Paper Industries"               },
  { symbol: "SMPP",   name: "Modern Shorouk Printing & Packaging"          },
  { symbol: "SINA",   name: "Sinai Manganese Company"                      },
  { symbol: "IEEC",   name: "Industrial & Engineering Enterprises"         },
  { symbol: "CFGH",   name: "Concrete Fashion Group"                       },
  { symbol: "MTIE",   name: "MM Group for Industry & International Trade"  },
  { symbol: "FNAR",   name: "Al Fanar Contracting & Construction"          },
  { symbol: "GDWA",   name: "Gadwa For Industrial Development"             },
  { symbol: "GMCI",   name: "GMC Group for Industrial & Commercial"        },
  { symbol: "YAYT",   name: "Spring & Transportation Needs Manufacturing"  },
  { symbol: "EFAC",   name: "Egyptian Ferro Alloys"                        },
  { symbol: "DCRC",   name: "Delta Construction & Rebuilding"              },
  // Chemicals & Fertilizers (12)
  { symbol: "ABUK",   name: "Abu Kir Fertilizers & Chemical Industries"    },
  { symbol: "SKPC",   name: "Sidi Kerir Petrochemicals"                    },
  { symbol: "MFPC",   name: "Misr Fertilizers Production (MOPCO)"          },
  { symbol: "EGCH",   name: "Egyptian Chemical Industries (KIMA)"          },
  { symbol: "PACH",   name: "Egyptian Paints (Pachin)"                     },
  { symbol: "MICH",   name: "Misr Chemical Industries"                     },
  { symbol: "SMFR",   name: "Samad Misr (EGYFERT)"                         },
  { symbol: "KZPC",   name: "Kafr El Zayat Pesticides & Chemical"          },
  { symbol: "NFCI",   name: "ELNASR Co For Fertilizers & Chemicals"        },
  { symbol: "ELAB",   name: "Egyptian Linear Alkyl Benzene (ELAB)"         },
  { symbol: "CID",    name: "Chemical & Industrial Development"             },
  { symbol: "MOSC",   name: "Misr Oils & Soap"                             },
  // Energy (8)
  { symbol: "AMOC",   name: "Alexandria Mineral Oils"                      },
  { symbol: "INEG",   name: "Integrated Engineering Group"                 },
  { symbol: "NDRL",   name: "National Drilling Company"                    },
  { symbol: "PMSC",   name: "Petroleum Marine Services"                    },
  { symbol: "TAQA",   name: "TAQA Arabia"                                  },
  { symbol: "EGAS",   name: "Egypt Gas Co."                                },
  { symbol: "ENPI",   name: "Engineering for Petroleum (Enppi)"            },
  { symbol: "GSSC",   name: "General Silos & Storage"                      },
  // Construction Materials (17)
  { symbol: "SUCE",   name: "Suez Cement"                                  },
  { symbol: "MCQE",   name: "Misr Cement (Qena)"                           },
  { symbol: "LCSW",   name: "Lecico Egypt"                                 },
  { symbol: "CERA",   name: "Arab Ceramic (Ceramica Remas)"                },
  { symbol: "SCEM",   name: "Sinai Cement"                                 },
  { symbol: "SVCE",   name: "South Valley Cement"                          },
  { symbol: "ARCC",   name: "Arabian Cement Company"                       },
  { symbol: "ALEX",   name: "Alexandria Cement"                            },
  { symbol: "MBSC",   name: "Misr Beni Suef Cement"                        },
  { symbol: "TORA",   name: "Tourah Cement"                                },
  { symbol: "ECAP",   name: "El Ezz Ceramics & Porcelain (Gemma)"          },
  { symbol: "MEGM",   name: "Middle East Glass Manufacturing"               },
  { symbol: "PRCL",   name: "General Co. for Ceramic & Porcelain"          },
  { symbol: "RUBX",   name: "Rubex International for Plastic & Acrylic"    },
  { symbol: "WATP",   name: "Modern Co. for Water Proofing"                },
  { symbol: "SIEG",   name: "Egyptian Co. for Pipes & Cement Products"     },
  { symbol: "KNGC",   name: "El Nasr Glass and Crystal"                    },
  // Healthcare (21)
  { symbol: "CLHO",   name: "Cleopatra Hospital Group"                     },
  { symbol: "PHAR",   name: "EIPICO"                                       },
  { symbol: "SPMD",   name: "Speed Medical"                                },
  { symbol: "RMDA",   name: "Rameda Pharmaceutical"                        },
  { symbol: "ISPH",   name: "Ibn Sina Pharma"                              },
  { symbol: "ADCI",   name: "Arab Pharmaceuticals"                         },
  { symbol: "AMES",   name: "Alexandria New Medical Center"                },
  { symbol: "APPC",   name: "Advanced Pharmaceutical Packaging"            },
  { symbol: "AXPH",   name: "Alexandria Pharmaceuticals & Chemical"        },
  { symbol: "BIOC",   name: "GlaxoSmithKline Egypt"                        },
  { symbol: "FCMD",   name: "Future Care for Medical Industries"           },
  { symbol: "MCRO",   name: "Macro Group Pharmaceutical"                   },
  { symbol: "MEPA",   name: "Medical Packaging Co."                        },
  { symbol: "MIPH",   name: "Minapharm Pharmaceuticals"                    },
  { symbol: "MPCI",   name: "Memphis Pharmaceutical & Chemical"            },
  { symbol: "NIPH",   name: "El-Nile Pharmaceuticals & Chemical"           },
  { symbol: "OCPH",   name: "October Pharma"                               },
  { symbol: "SIPC",   name: "Sabaa International for Pharmaceutical"       },
  { symbol: "UPMS",   name: "Union Pharmacist for Medical Services"        },
  { symbol: "NINH",   name: "Nozha International Hospital"                 },
  { symbol: "CPCI",   name: "Kahira Pharmaceuticals & Chemical"            },
  // Food & Beverage (28)
  { symbol: "JUFO",   name: "Juhayna Food Industries"                      },
  { symbol: "DOMT",   name: "Arabian Food Industries (Domty)"              },
  { symbol: "EFID",   name: "Edita Food Industries"                        },
  { symbol: "POUL",   name: "Cairo Poultry Group"                          },
  { symbol: "AJWA",   name: "Ajwa Group for Food Industries Egypt"         },
  { symbol: "ISMA",   name: "Ismailia Misr Poultry"                        },
  { symbol: "IFAP",   name: "International Agricultural Products"          },
  { symbol: "OLFI",   name: "Obour Land for Food Industries"               },
  { symbol: "INFI",   name: "Ismailia National Food Industries"            },
  { symbol: "SUGR",   name: "Delta Sugar"                                  },
  { symbol: "AFMC",   name: "Alexandria Flour Mills"                       },
  { symbol: "MILS",   name: "North Cairo Mills"                            },
  { symbol: "SCFM",   name: "South Cairo & Giza Mills"                     },
  { symbol: "WCDF",   name: "Middle & West Delta Flour Mills"               },
  { symbol: "UEFM",   name: "Upper Egypt Flour Mills"                      },
  { symbol: "EDFM",   name: "East Delta Flour Mills"                       },
  { symbol: "CEFM",   name: "Middle Egypt Flour Mills"                     },
  { symbol: "SNFC",   name: "Sharkia National Food"                        },
  { symbol: "SNFI",   name: "Souhag National Food Industries"              },
  { symbol: "EPCO",   name: "Egypt for Poultry Co."                        },
  { symbol: "MPCO",   name: "Mansourah Poultry"                            },
  { symbol: "GOUR",   name: "Gourmet Egypt Foods"                          },
  { symbol: "ZEOT",   name: "Extracted Oils & Derivatives"                 },
  { symbol: "ADPC",   name: "Arab Dairy Products (Panda)"                  },
  { symbol: "AIFI",   name: "Atlas for Investment & Food Industries"       },
  { symbol: "ELNA",   name: "El Nasr for Manufacturing Agricultural Crops" },
  { symbol: "MFSC",   name: "Misr Duty Free Shops"                         },
  { symbol: "KABO",   name: "El Nasr Clothing & Textiles"                  },
  // Technology (10)
  { symbol: "FWRY",   name: "Fawry for Banking Technology & Electronic Payment"},
  { symbol: "EFIH",   name: "e-finance for Digital & Financial Investments" },
  { symbol: "VERT",   name: "Vertika for Industry & Trade"                 },
  { symbol: "RACC",   name: "Raya Contact Center"                          },
  { symbol: "AMPI",   name: "AL Moasher Pay for Electronic Payment"        },
  { symbol: "DGTZ",   name: "Digitize for Investment & Technology"         },
  { symbol: "EGSA",   name: "Egyptian Satellite Co."                       },
  { symbol: "SCTS",   name: "Suez Canal Co. for Technology Settling"       },
  { symbol: "FTNS",   name: "Fitness Prime"                                },
  { symbol: "GEOS",   name: "Geos for Trading and Contracting"             },
  // Textile (9)
  { symbol: "ORWE",   name: "Oriental Weavers Carpet"                      },
  { symbol: "DSCW",   name: "Dice Sport & Casual Wear Manufacturers"       },
  { symbol: "ACGC",   name: "Arab Cotton Ginning"                          },
  { symbol: "APSW",   name: "Arab Polvara Spinning & Weaving"              },
  { symbol: "GTWL",   name: "Golden Textiles & Clothes Wool"               },
  { symbol: "NCGC",   name: "Nile Cotton Ginning"                          },
  { symbol: "SPIN",   name: "Alexandria Spinning & Weaving"                },
  { symbol: "GTEX",   name: "G-TEX for Commercial and Industrial"          },
  // Agriculture (7)
  { symbol: "AALR",   name: "General Co. for Land Reclamation"             },
  { symbol: "EALR",   name: "El Arabia for Land Reclamation"               },
  { symbol: "GGRN",   name: "Gogreen Agricultural Investment"              },
  { symbol: "KRDI",   name: "Al Khair River for Agricultural Development"  },
  { symbol: "LUTS",   name: "Lotus Agricultural Investments"               },
  { symbol: "NEDA",   name: "Northern Upper Egypt Development & Agricultural"},
  { symbol: "WKOL",   name: "Wadi Kom Ombo Land Reclamation"               },
  // 4 additional stocks confirmed in TradingView scanner
  { symbol: "SAUD",   name: "Al Baraka Bank Egypt"                         },
  { symbol: "ARAB",   name: "Arab Developers Holding"                      },
  { symbol: "DAPH",   name: "Development & Engineering Consultants"        },
  { symbol: "HBCO",   name: "Heibco"                                       },
  // Insurance (3)
  { symbol: "DEIN",   name: "Delta Insurance"                              },
  { symbol: "MOIN",   name: "Mohandes Insurance"                           },
  { symbol: "MLIC",   name: "Misr Life Insurance"                          },
  // Education (5)
  { symbol: "CIRA",   name: "CIRA Education"                               },
  { symbol: "CAED",   name: "Cairo Educational Services"                   },
  { symbol: "EEP",    name: "Egypt Education Platform"                     },
  { symbol: "TALM",   name: "Taaleem Management Services"                  },
  { symbol: "MOED",   name: "Egyptian Modern Education Systems"            },
  // Transportation (7)
  { symbol: "ALCN",   name: "Alexandria Container & Cargo Handling"        },
  { symbol: "ETRS",   name: "Egyptian Transport (Egytrans)"                },
  { symbol: "CSAG",   name: "Canal Shipping Agencies"                      },
  { symbol: "DCCC",   name: "Damietta Container & Cargo Handling"          },
  { symbol: "POCO",   name: "Port Said Container & Cargo Handling"         },
  { symbol: "EGWA",   name: "General Warehouses of Egypt"                  },
  { symbol: "BIDI",   name: "El Badr Investment and Development"           },
];

// ─── Global stock ticker list — 8 symbols, fits Twelve Data free tier (8 credits/min) ───
// `symbol` is what Twelve Data and Stooq both index by. GLOBAL_EXCHANGE
// below is what the TradingView fetcher uses.

const GLOBAL_TICKERS = [
  { symbol: "SPY",   name: "S&P 500 (SPDR ETF)"       },
  { symbol: "QQQ",   name: "NASDAQ 100 (Invesco ETF)" },
  { symbol: "AAPL",  name: "Apple Inc."               },
  { symbol: "MSFT",  name: "Microsoft Corp."          },
  { symbol: "NVDA",  name: "NVIDIA Corp."             },
  { symbol: "GOOGL", name: "Alphabet Inc."            },
  { symbol: "AMZN",  name: "Amazon.com Inc."          },
  { symbol: "TSLA",  name: "Tesla Inc."               },
];

// Verified live against TradingView's scanner (not guessed) — all 8 resolved
// on 2026-07-30. SPY is an AMEX-listed ETF; the rest are NASDAQ.
const GLOBAL_EXCHANGE: Record<string, string> = {
  SPY: "AMEX", QQQ: "NASDAQ", AAPL: "NASDAQ", MSFT: "NASDAQ",
  NVDA: "NASDAQ", GOOGL: "NASDAQ", AMZN: "NASDAQ", TSLA: "NASDAQ",
};

const TROY_OZ = 31.1034768;  // exact grams per troy ounce
const PURITY: Record<string, number> = {
  "24k": 1,
  "22k": 22 / 24,   // 91.6667%
  "21k": 21 / 24,   // 87.5000%
  "18k": 18 / 24,   // 75.0000%
};

const FALLBACK_EGP    = 51.0;

// Generic browser identity, reused by Stooq's fetches — the only remaining caller.
const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of u.searchParams.keys()) {
      if (/key|token|secret/i.test(key)) u.searchParams.set(key, "***");
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    logger.warn({ url: redactUrl(url), err: err instanceof Error ? err.message : err }, "safeFetch: request failed");
    return null;
  }
}

async function safeJson<T>(res: Response | null, label?: string): Promise<T | null> {
  if (!res) {
    if (label) logger.warn({ label }, "safeJson: no response (network error or timeout)");
    return null;
  }
  if (!res.ok) {
    if (label) {
      const body = await res.text().catch(() => "<unreadable>");
      logger.warn({ label, status: res.status, statusText: res.statusText, body: body.slice(0, 500) }, "safeJson: non-OK response");
    }
    return null;
  }
  try { return await res.json() as T; } catch { return null; }
}

function round2(n: number) { return Math.round(n * 100) / 100; }

// ─── Metals via TradingView CFD scanner (TVC:GOLD / TVC:SILVER) ──────────────
// Free, no API key, same source as TradingView charts. Returns USD/oz spot.
// change_abs = today_close - prev_close  →  prevClose = close - change_abs

interface TVMetalsRow { s: string; d: [number, number, number] }

async function fetchMetalsViaTradingView(): Promise<{
  xau: number; xag: number;
  xauPrevClose: number; xagPrevClose: number;
} | null> {
  const res = await safeFetch("https://scanner.tradingview.com/global/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin":  "https://www.tradingview.com",
      "Referer": "https://www.tradingview.com/",
    },
    body: JSON.stringify({
      symbols: { tickers: ["TVC:GOLD", "TVC:SILVER"] },
      columns: ["close", "change_abs", "change"],
    }),
  });

  if (!res?.ok) {
    logger.warn({ status: res?.status }, "TradingView metals scanner: bad response");
    return null;
  }

  const data = await res.json() as { data: TVMetalsRow[] };
  if (!data?.data?.length) return null;

  const bySym: Record<string, [number, number, number]> = {};
  for (const item of data.data) bySym[item.s] = item.d;

  const gold   = bySym["TVC:GOLD"];
  const silver = bySym["TVC:SILVER"];
  if (!gold || !silver || gold[0] <= 0 || silver[0] <= 0) return null;

  return {
    xau:          gold[0],
    xag:          silver[0],
    xauPrevClose: gold[0]   - gold[1],
    xagPrevClose: silver[0] - silver[1],
  };
}

// A TradingView scanner miss (timeout, rate limit, transient network error —
// safeFetch's own comments confirm these happen occasionally, not
// hypothetically) used to fall straight through to FALLBACK_GOLD/
// FALLBACK_SILVER below — hardcoded constants that are only ever as fresh as
// whenever someone last updated them. Every holding's value (and the
// portfolio alert cron's ±1% check) is computed from goldUsd/silverUsd, so
// one blip swapped in a stale fixed number for every gold/silver holder,
// producing a portfolio "move" that was really just a fallback artifact —
// same class of bug fetchUsdToEgp's memo below was built to prevent for FX.
// A live quote from minutes ago is far closer to the truth than a
// long-fixed constant, so remember the last real read and prefer it; the
// hardcoded constant is now truly the last resort (a brand-new deploy that
// has never once reached TradingView).
const METALS_MEMO_TTL_MS = 24 * 60 * 60_000;
let _metalsMemo: { xau: number; xag: number; at: number } | null = null;

function rememberMetals(xau: number, xag: number): void {
  _metalsMemo = { xau, xag, at: Date.now() };
}

function recentMetals(): { xau: number; xag: number; ageMs: number } | null {
  if (!_metalsMemo) return null;
  const ageMs = Date.now() - _metalsMemo.at;
  return ageMs <= METALS_MEMO_TTL_MS ? { xau: _metalsMemo.xau, xag: _metalsMemo.xag, ageMs } : null;
}

// ─── USD → EGP exchange rate ───────────────────────────────────────────────────
// CIB Egypt's own posted rate is the primary source (explicit product
// decision, 2026-08-02, superseding the 2026-07-30 "Wise only" call) — it's
// a real Egyptian bank's rate, which is what most users actually mean by
// "the dollar rate," and unlike Wise it doesn't go stale over the weekend
// (Egypt's banking week runs Sun-Thu; Wise's EGP feed tracks the global FX
// week, closed Sat/Sun UTC, so it just repeats Friday's close all day
// Sunday — reachable and "correct" by its own clock, just not
// representative of Egypt's actual rate that day).
//
// Wise remains the fallback for whenever CIB is unreachable (it sits behind
// Incapsula bot-protection — see fetchCibRates() below — so this happens
// occasionally, not hypothetically). On every day except Sunday, Wise's own
// number is live and accurate, so a CIB miss falls straight through to it.
// On a Sunday specifically, a CIB miss instead prefers the last remembered
// rate over Wise's known-stale weekend number — see the Sunday branch in
// fetchUsdToEgp() below. Only if nothing has ever succeeded does the app
// fall back to a hardcoded constant (FALLBACK_EGP) — never a third
// provider's number standing in unannounced.

interface WiseRateResponse { source: string; target: string; value: number; time: number }

function isCairoSunday(): boolean {
  return new Date(`${cairoDateString()}T00:00:00Z`).getUTCDay() === 0;
}

// Requests with no User-Agent from a cloud datacenter IP are exactly what a
// bot-blocker flags first — Render's outbound IPs are datacenter, not
// residential. Presenting as an ordinary browser hit makes Wise no more
// likely to reject us than any other visitor to wise.com.
const WISE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://wise.com/",
  "Accept": "application/json",
};

interface CibRatesResponse { rates: { currencyID: string; buyRate: number; sellRate: number }[] }

// CIB sits behind Incapsula bot-protection, which tolerates occasional hits
// but starts serving a JS-challenge page instead of real data once it sees
// repeated requests in a short window (confirmed directly: 3 plain requests
// a few seconds apart were enough to get blocked). A bank's own posted rate
// also has no reason to be re-checked every 30s the way a live market quote
// does. This cache does double duty: it keeps CIB's actual request rate low
// enough to stay under Incapsula's radar, and it's the reason the primary
// FX figure doesn't need a fresh network round-trip on every price refresh.
// 1 request/min is a steady, gentle rate — a different pattern from the
// rapid burst that triggered blocking, so this stays well clear of that
// while cutting how stale a rate can be from 5 minutes down to 1.
const cibRatesCache = makeCache<Record<string, number>>(60_000);

// CIB Egypt's public currency-converter API (no key required) — the primary
// FX source, tried before Wise on every request (see the policy comment
// above fetchUsdToEgp). Returns the bank's own buy/sell rates per currency;
// we take the midpoint as the closest equivalent to Wise's single
// mid-market figure everywhere else in this file.
async function fetchCibRates(): Promise<Record<string, number> | null> {
  const cached = cibRatesCache.get();
  if (cached) return cached;

  const res = await safeFetch("https://www.cibeg.com/api/currency/rates", {
    headers: { "User-Agent": WISE_HEADERS["User-Agent"], "Accept": "application/json" },
  });
  const data = await safeJson<CibRatesResponse>(res, "cib-rates");
  if (!data?.rates?.length) return null;

  const out: Record<string, number> = {};
  for (const r of data.rates) {
    if (r.buyRate > 0 && r.sellRate > 0) out[r.currencyID] = (r.buyRate + r.sellRate) / 2;
  }
  cibRatesCache.set(out);
  return out;
}

// ─── Wise short-term memo ─────────────────────────────────────────────────────
//
// Wise is the only *live* rate in the chain; every other source below it is a
// once-a-day figure. When Wise fails — it throttles datacenter IPs and the
// 9s timeout trips from time to time — the chain silently dropped to
// fawazahmed0, whose USD/EGP is a single daily value (50.50684863 on
// 2026-07-29). It does not move for the rest of the day, so a brief Wise
// outage showed as the app being frozen for hours while wise.com plainly
// read 50.67.
//
// A Wise quote from a few minutes ago is far closer to the truth than a
// figure fixed at midnight, so keep the last good one and prefer it over the
// daily sources. The daily sources remain as the last resort, for a Wise
// outage longer than this window or a cold start that never reached Wise.
const WISE_MEMO_TTL_MS = 24 * 60 * 60_000;
const _wiseMemo = new Map<string, { value: number; at: number }>();

function rememberWise(key: string, value: number): number {
  _wiseMemo.set(key, { value, at: Date.now() });
  return value;
}

function recentWise(key: string): { value: number; ageMs: number } | null {
  const m = _wiseMemo.get(key);
  if (!m) return null;
  const ageMs = Date.now() - m.at;
  return ageMs <= WISE_MEMO_TTL_MS ? { value: m.value, ageMs } : null;
}

// USD/EGP now comes from CIB Egypt first, every day — explicit product
// decision (2026-08-02, superseding the earlier "Wise only" call). CIB is
// a real Egyptian bank's own posted rate, which is what most users actually
// care about; Wise remains the fallback for whenever CIB is unavailable
// (rate-limited by Incapsula, network error, etc.), not a second primary
// source silently standing in for it.
async function fetchUsdToEgp(): Promise<number> {
  const cib = await fetchCibRates();
  const usd = cib?.USD;
  if (usd && usd > 0) {
    logger.info({ rate: usd, source: "cib" }, "USD/EGP from CIB");
    return rememberWise("USD", usd);
  }

  // CIB unavailable this cycle. Sunday is the one day Wise is known to be
  // structurally stale (it tracks the global FX week, closed Sat/Sun UTC,
  // so it just repeats Friday's close all day) rather than actually broken
  // — falling through to it there would swap in a number that's wrong, not
  // just different, so on Sundays specifically prefer the last remembered
  // rate over a fresh Wise read. Every other day Wise is a live, accurate
  // rate in its own right, so falling straight through to it is correct.
  if (isCairoSunday()) {
    const memo = recentWise("USD");
    if (memo) {
      logger.warn({ rate: memo.value, ageMs: memo.ageMs }, "USD/EGP: CIB unavailable on a Sunday — reusing last remembered rate instead of Wise's stale weekend number");
      return memo.value;
    }
  }

  async function tryWise(): Promise<number | null> {
    const wise = await safeJson<WiseRateResponse>(
      await safeFetch("https://wise.com/rates/live?source=USD&target=EGP", { headers: WISE_HEADERS }),
      "wise-usd-egp",
    );
    return wise?.value && wise.value > 0 ? wise.value : null;
  }

  // One immediate retry — a single dropped request or a transient edge-node
  // hiccup shouldn't be enough to fall back to a stale memo.
  const rate = (await tryWise()) ?? (await tryWise());
  if (rate !== null) {
    logger.info({ rate, source: "wise-fallback" }, "USD/EGP from Wise (CIB unavailable)");
    return rememberWise("USD", rate);
  }

  // Both CIB and Wise unreachable — reuse the last rate either one gave us,
  // however old, rather than ever substituting a fabricated number.
  const memo = recentWise("USD");
  if (memo) {
    const ageMin = Math.round(memo.ageMs / 60_000);
    logger.warn({ rate: memo.value, ageMinutes: ageMin, source: "memo" },
      ageMin > 60
        ? `USD/EGP: both CIB and Wise unreachable for ${ageMin} min — reusing this stale rate, no fabricated source will be substituted, but this needs attention`
        : "USD/EGP: both CIB and Wise unreachable, reusing the last rate either gave us");
    return memo.value;
  }

  // Neither source has ever succeeded (a brand new deploy). There's truly
  // nothing to fall back to yet.
  logger.error("USD/EGP: neither CIB nor Wise has ever succeeded on this instance — using the hardcoded constant until one does");
  return FALLBACK_EGP;
}

// ─── FX cross rates via CIB, Wise fallback (same policy as USD/EGP) ───────────
// CIB first for every pair it quotes (EUR, GBP, CHF, SAR, KWD as of writing).
// Wise is strictly the fallback — reached only when CIB has no value for a
// given pair, whether because the whole CIB fetch failed or because CIB
// simply doesn't publish that currency at all (TRY/CNY/QAR/AED). Never used
// in parallel with CIB and never preferred over it. No pair is ever filled
// in from a third provider (e.g. open.er-api.com); a pair with no CIB
// reading, no Wise reading, and no memo is simply left out of the returned
// object — every caller already treats a missing rate as "unknown"
// (`fx.EUR ?? 0` and friends), which is honest.

const FX_SYMBOLS = ['EUR', 'GBP', 'TRY', 'CNY', 'CHF', 'QAR', 'SAR', 'AED', 'KWD'] as const;

async function fetchFxCrossRates(_usdToEgp: number): Promise<Record<string, number>> {
  // CIB first, every day — same policy as USD/EGP above. CIB only quotes a
  // subset of FX_SYMBOLS (EUR, GBP, CHF, SAR, KWD as of writing); TRY/CNY/
  // QAR/AED always come from Wise since CIB has no equivalent for them.
  const cibRates = await fetchCibRates();
  // Distinguishes "CIB doesn't quote this pair" (cibRates came back fine,
  // just without this symbol — normal, use Wise) from "the whole CIB fetch
  // failed" (Incapsula block, network error). Only the latter, and only on
  // a Sunday (the one day Wise's own number is known-stale rather than
  // just different — see fetchUsdToEgp), prefers each symbol's last
  // remembered value over a fresh Wise read.
  const cibFetchFailed = cibRates === null;

  async function tryWiseFor(sym: string): Promise<number | null> {
    const data = await safeJson<WiseRateResponse>(
      await safeFetch(`https://wise.com/rates/live?source=${sym}&target=EGP`, { headers: WISE_HEADERS }),
      `wise-${sym}-egp`,
    );
    return data?.value && data.value > 0 ? data.value : null;
  }

  const settled = await Promise.allSettled(
    FX_SYMBOLS.map(async sym => {
      const cibValue = cibRates?.[sym];
      if (cibValue && cibValue > 0) return { sym, value: cibValue, source: "cib" as const };
      if (cibFetchFailed && isCairoSunday()) {
        const memo = recentWise(sym);
        if (memo) return { sym, value: memo.value, source: "cib" as const };
      }
      return { sym, value: (await tryWiseFor(sym)) ?? (await tryWiseFor(sym)), source: "wise-fallback" as const };
    })
  );

  const out: Record<string, number> = {};

  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const { sym, value, source } = r.value;
    if (value !== null) {
      out[sym] = Math.round(value * 10000) / 10000;
      rememberWise(sym, value);
      logger.info({ sym, rate: value, source }, source === "cib" ? "FX from CIB" : "FX from Wise (CIB unavailable)");
      continue;
    }
    const memo = recentWise(sym);
    if (memo) {
      out[sym] = Math.round(memo.value * 10000) / 10000;
      logger.warn({ sym, rate: memo.value, ageMs: memo.ageMs, source: "memo" },
        "FX: both CIB and Wise unreachable, reusing the last rate either gave us");
    } else {
      logger.error({ sym }, "FX: neither CIB nor Wise has ever succeeded for this pair on this instance — omitting it");
    }
  }

  return out;
}

// A hardcoded metals-hours gate (Sun 22:00 - Fri 22:00 UTC) used to force
// gold/silver to 0% while the market was shut. It is gone: now that both
// metals measure from yesterday's stored Cairo-day close, a shut market
// yields 0.00% on its own — the live price is frozen at the very value that
// close was derived from — with no approximated calendar to drift from
// reality.

// ─── Daily EGP close snapshot ─────────────────────────────────────────────────
// For an EGP-held investment, "today's change" should mean exactly one thing:
// today's EGP price vs. yesterday's EGP price — the same numbers this API
// displays in Markets, diffed against themselves. Reconstructing that change
// from a separate USD move and a separate historical FX lookup (below, kept
// only as a bootstrap fallback for a brand-new deployment with no history
// yet) leaves room for the two sources to disagree on timing.
//
// This used to be an in-memory Map, which seemed fine but silently broke:
// any server restart (a redeploy, or the host recycling an idle instance)
// wipes it, forcing the USD+FX fallback — which itself reads "yesterday"
// using UTC day boundaries, not Cairo's, so right after Cairo midnight it
// actually fetches a rate from *two* Cairo-days ago. The result: a change%
// that doesn't reset at the start of a new day the way every other market
// does, staying anchored to a stale reference until the fallback's own
// source happens to update. Persisting to the database instead means a
// restart can never lose the real previous close.

interface MarketCloseSnapshot { goldEgp24k: number; silverEgp: number; usdToEgp: number; }

// Keeps "today"'s row continuously updated to the latest live price (so
// whatever was last written before the Cairo day rolls over becomes that
// day's fixed close in the database), and returns:
//  - prevClose: the most recent *prior* day's close, if one is on record —
//    the real, correct "today vs. yesterday" reference.
//  - todayOpen: whatever today's own first-ever recorded value was — used
//    only when prevClose doesn't exist yet (a brand new day, or the first
//    day this table has any data at all), so there's still something real
//    to show movement against instead of a flat 0% until the next midnight.
async function recordAndGetPrevClose(
  today: string,
  current: MarketCloseSnapshot
): Promise<{ prevClose: MarketCloseSnapshot | null; todayOpen: MarketCloseSnapshot | null }> {
  try {
    await db
      .insert(marketCloseSnapshotsTable)
      .values({
        date: today,
        openGoldEgp24k: current.goldEgp24k, openSilverEgp: current.silverEgp, openUsdToEgp: current.usdToEgp,
        goldEgp24k: current.goldEgp24k, silverEgp: current.silverEgp, usdToEgp: current.usdToEgp,
      })
      .onConflictDoUpdate({
        // Only the "close" columns update on repeat writes the same day —
        // open* is set once at insert and never touched again.
        target: marketCloseSnapshotsTable.date,
        set: { goldEgp24k: current.goldEgp24k, silverEgp: current.silverEgp, usdToEgp: current.usdToEgp, updatedAt: new Date() },
      });

    const [prev] = await db
      .select({ goldEgp24k: marketCloseSnapshotsTable.goldEgp24k, silverEgp: marketCloseSnapshotsTable.silverEgp, usdToEgp: marketCloseSnapshotsTable.usdToEgp })
      .from(marketCloseSnapshotsTable)
      .where(lt(marketCloseSnapshotsTable.date, today))
      .orderBy(desc(marketCloseSnapshotsTable.date))
      .limit(1);

    const [open] = await db
      .select({ goldEgp24k: marketCloseSnapshotsTable.openGoldEgp24k, silverEgp: marketCloseSnapshotsTable.openSilverEgp, usdToEgp: marketCloseSnapshotsTable.openUsdToEgp })
      .from(marketCloseSnapshotsTable)
      .where(eq(marketCloseSnapshotsTable.date, today));

    return { prevClose: prev ?? null, todayOpen: open ?? null };
  } catch (err) {
    logger.warn({ err }, "recordAndGetPrevClose: DB read/write failed, falling back to USD+FX reconstruction");
    return { prevClose: null, todayOpen: null };
  }
}

// ─── Assemble prices ──────────────────────────────────────────────────────────

export async function fetchPrices(): Promise<MarketPricesResponse> {
  // Metals + the USD/EGP rate run in parallel — TradingView scanner is
  // ~100-200 ms, no key needed. fetchFxCrossRates needs the real usdToEgp
  // for its ER-API cross-rate fallback (any pair Wise fails to return), so
  // it has to wait for that instead of running alongside it — it used to
  // fire with a hardcoded ~51.0 constant instead, which meant any pair that
  // hit that fallback got a cross-rate off by however far usdToEgp had
  // actually drifted from 51.0.
  const [metals, usdToEgp] = await Promise.all([
    fetchMetalsViaTradingView(),
    fetchUsdToEgp(),
  ]);
  const fxRates = await fetchFxCrossRates(usdToEgp);

  let goldUsd: number;
  let silverUsd: number;
  if (metals) {
    rememberMetals(metals.xau, metals.xag);
    goldUsd = metals.xau;
    silverUsd = metals.xag;
  } else {
    const memo = recentMetals();
    if (!memo) {
      // Truly nothing to fall back to (a brand-new deploy that hasn't
      // reached TradingView even once) — no hardcoded constant left to
      // paper over this with. Every caller of fetchPrices()/getCachedPrices()
      // already wraps its call in a try/catch that logs and degrades
      // gracefully (skips this cron tick, returns a 500 to the client),
      // so throwing here is safe and, unlike a fabricated number, honest.
      logger.error("Metals: TradingView unreachable and no remembered price yet — refusing to fabricate a price");
      throw new Error("Metals prices unavailable: TradingView unreachable and no prior successful fetch to fall back to");
    }
    logger.warn({ xau: memo.xau, xag: memo.xag, ageMs: memo.ageMs },
      "Metals: TradingView unreachable — reusing last remembered gold/silver prices");
    goldUsd = memo.xau;
    silverUsd = memo.xag;
  }

  const price24k = round2((goldUsd * usdToEgp) / TROY_OZ);
  const goldEgpPerGram: Record<string, number> = {
    "24k": price24k,
    "22k": round2(price24k * (22 / 24)),
    "21k": round2(price24k * (21 / 24)),
    "18k": round2(price24k * (18 / 24)),
  };
  const silverEgpPerGram = round2((silverUsd * usdToEgp) / TROY_OZ);
  const usdToEgpDisplay  = Math.round(usdToEgp * 10000) / 10000;

  // One baseline for every figure below: yesterday's Cairo-day close, from
  // this endpoint's own recorded history. Every "today" in the app —
  // cash, USD/EGP, fixed income, EGX, and now the metals — therefore resets
  // at the same instant, Cairo midnight.
  //
  // Metals used to read TradingView's own xauPrevClose instead, so they
  // reset on its session clock while everything else reset on Cairo's. That
  // meant a gold holding's EGP change compounded two differently-clocked
  // legs and silently changed composition at moments neither market moved.
  // The tradeoff accepted in exchange: the % here no longer matches what
  // TradingView displays for gold, since it is now measured from Cairo
  // midnight rather than from TradingView's session.
  const { prevClose } = await recordAndGetPrevClose(tradingDayKey(), {
    goldEgp24k: price24k, silverEgp: silverEgpPerGram, usdToEgp: usdToEgpDisplay,
  });

  // Yesterday's close in USD, recovered from the stored EGP close and the
  // stored rate — the exact inverse of how price24k was built from them, so
  // no separate USD history has to be kept in step with the EGP one.
  const prevUsd = (egpClose: number): number =>
    prevClose && prevClose.usdToEgp > 0 ? (egpClose * TROY_OZ) / prevClose.usdToEgp : 0;
  const pctFrom = (now: number, before: number): number =>
    before > 0 ? round2(((now - before) / before) * 100) : 0;

  // No market-open gate needed any more, and none is applied: while metals
  // are shut goldUsd is frozen at the same value yesterday's close was
  // derived from, so this falls out as 0.00% on its own.
  const prevGoldUsd   = prevUsd(prevClose?.goldEgp24k ?? 0);
  const prevSilverUsd = prevUsd(prevClose?.silverEgp ?? 0);

  const goldChange    = prevGoldUsd > 0 ? round2(goldUsd - prevGoldUsd) : 0;
  const goldChangePct = pctFrom(goldUsd, prevGoldUsd);

  const silverChange    = prevSilverUsd > 0 ? round2(silverUsd - prevSilverUsd) : 0;
  const silverChangePct = pctFrom(silverUsd, prevSilverUsd);

  // Same Cairo-midnight baseline as the metals above. USD/EGP has no
  // reliable "own previous close" the way TradingView gives metals — Wise
  // doesn't expose one, and the free daily-snapshot APIs previously used to
  // reconstruct it turned out to be unreliably stale (see the removed
  // fetchUsdToEgpPrevClose — a response with no way to tell it was ~24h+
  // old) — so this endpoint's own recorded history is the reference, and it
  // honestly shows 0% until a real prior-day close exists.
  //
  // A same-day "opening value" fallback was tried and reverted: by the time
  // that tracking could be added, the real early-morning rate was already
  // gone (only a continuously-overwritten "current" value existed, no true
  // open snapshot), so the backfilled "open" was actually just "whatever
  // the rate happened to be a few minutes before this code shipped" — a
  // fake reference producing a technically-real but meaningless tiny number
  // that didn't reflect the actual overnight move. Same principle as
  // removing the third-party fallback: a plausible-looking wrong number is
  // worse than an honest 0.
  const usdToEgpChangePercent = pctFrom(usdToEgpDisplay, prevClose?.usdToEgp ?? 0);

  // What portfolio "today's gain" reads. Measured straight off the stored
  // EGP close rather than compounding the USD and FX legs: all three now
  // share one baseline, so the direct diff is exact and cannot drift from
  // its own parts the way the compounded form could.
  const goldChangePercentEgp   = pctFrom(price24k, prevClose?.goldEgp24k ?? 0);
  const silverChangePercentEgp = pctFrom(silverEgpPerGram, prevClose?.silverEgp ?? 0);

  return {
    goldUsd:             round2(goldUsd),
    silverUsd:           round2(silverUsd),
    usdToEgp:            usdToEgpDisplay,
    usdToEgpChangePercent,
    goldChange,
    goldChangePercent:   goldChangePct,
    goldChangePercentEgp,
    silverChange,
    silverChangePercent: silverChangePct,
    silverChangePercentEgp,
    goldEgpPerGram,
    silverEgpPerGram,
    fxRates,
    lastUpdated: new Date().toISOString(),
    sources:     metals ? ["tradingview-cfd"] : ["fallback"],
  };
}

// ─── EGX via TradingView Egypt scanner ────────────────────────────────────────
// No filter — fetches ALL 292 EGX stocks in one request.
// columns: [close, change_abs, change%, volume]

// Build lookup maps from our authoritative EGX ticker list
const EGX_NAMES: Record<string, string>  = Object.fromEntries(EGX_TICKERS.map(t => [t.symbol, t.name]));
const EGX_SYMBOL_SET: Set<string>        = new Set(EGX_TICKERS.map(t => t.symbol));

// Batch size kept at 150 — TradingView accepts it in one call with no rate issues.
const TV_BATCH_SIZE = 150;

// Does this bar belong to a session that ran today (Cairo)? TradingView's
// "time" column is unix seconds for the row's bar; between sessions it keeps
// serving the previous one, so its date is what separates a live change from
// a stale one. Missing/zero is treated as stale rather than assumed live —
// reporting 0% costs nothing, reporting a stale move as today's is the bug
// this exists to prevent.
function isEgxSessionToday(barTime: number | null | undefined): boolean {
  if (!barTime) return false;
  return tradingDayKey(new Date(barTime * 1000)) === tradingDayKey();
}

// Columns returned per ticker: [close, change_abs, change%, volume, market_cap, 52w_high, 52w_low,
// P/E, div_yield, sector, EPS (TTM), revenue growth YoY (TTM), net margin (TTM), ROE (TTM),
// debt/equity (MRQ), price/book (FY)]
type TVRow = [
  number, number, number, number | null, number | null, number | null, number | null,
  number | null, number | null, string | null, number | null, number | null,
  number | null, number | null, number | null, number | null,
  number | null, // time — unix seconds of this row's bar (see isEgxSessionToday)
  number | null, // total_debt
  number | null, // current_ratio
  number | null, // quick_ratio
  number | null, // return_on_assets
  number | null, // free_cash_flow_ttm
  number | null, // cash_n_short_term_invest_fq
  number | null, // number_of_employees
];

async function fetchEGXViaTradingView(): Promise<EGXStockResponse[]> {
  const allSymbols = EGX_TICKERS.map(t => t.symbol);
  const priceMap: Record<string, TVRow> = {};

  // Split into batches and query each with explicit symbol list so TradingView
  // returns prices for every ticker, not just its own "top active" subset.
  for (let i = 0; i < allSymbols.length; i += TV_BATCH_SIZE) {
    const batch = allSymbols.slice(i, i + TV_BATCH_SIZE);
    const body = JSON.stringify({
      columns: [
        // Verified live against TradingView's scanner (not guessed): "52_week_high"/"52_week_low"/
        // "P.E" all silently return null for every EGX ticker — the working field names are
        // "price_52_week_high"/"price_52_week_low"/"price_earnings_ttm".
        "close", "change_abs", "change", "volume", "market_cap_basic", "price_52_week_high", "price_52_week_low",
        "price_earnings_ttm", "dividends_yield_current", "sector", "earnings_per_share_basic_ttm",
        "total_revenue_yoy_growth_ttm", "after_tax_margin", "return_on_equity", "debt_to_equity",
        "price_book_ratio",
        // Unix seconds for the bar this row describes — i.e. which session
        // "change" is measured over. Appended last on purpose: the columns
        // array is positional, so adding anywhere else shifts every index
        // in the destructure below. Verified live (not guessed) — returns
        // the session open, e.g. 1786604400 = 13/08/2026 10:00 Cairo, EGX's
        // Thursday open. "market_status" and "is_market_open" were tried
        // first and both return null for EGX tickers.
        "time",
        // Appended after "time" for the same positional reason.
        "total_debt",
        // Deeper financials, appended last again for the same reason.
        // Verified live: "current_ratio"/"quick_ratio"/"return_on_assets"/
        // "free_cash_flow_ttm"/"cash_n_short_term_invest_fq"/
        // "number_of_employees" all return real values for at least some EGX
        // tickers (COMI, HRHO, SWDY spot-checked) — sparser than the core
        // set, never guessed.
        "current_ratio", "quick_ratio", "return_on_assets", "free_cash_flow_ttm",
        "cash_n_short_term_invest_fq", "number_of_employees",
      ],
      symbols: { tickers: batch.map(s => `EGX:${s}`) },
    });

    const res = await safeFetch("https://scanner.tradingview.com/egypt/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://www.tradingview.com" },
      body,
    });
    if (!res?.ok) throw new Error(`TV scanner ${res?.status}`);

    const data = await res.json() as { data: Array<{ s: string; d: TVRow }> };
    if (!data?.data) throw new Error("TV scanner: no data field");

    for (const item of data.data) {
      const sym = item.s.replace(/^EGX:/, "");
      priceMap[sym] = item.d;
    }
  }

  const results: EGXStockResponse[] = [];
  for (const { symbol, name } of EGX_TICKERS) {
    const d = priceMap[symbol];
    if (!d) continue;
    const [
      close, changeAbs, changePct, volume, marketCap, high52w, low52w, pe, divYield,
      sector, epsTtm, revenueGrowthYoy, netMargin, roe, debtToEquity, priceToBook,
      barTime, totalDebt,
      currentRatio, quickRatio, returnOnAssets, freeCashFlowTtm, cashAndEquivalents, employees,
    ] = d;
    if (!close) continue;                              // skip if TV returned no price
    // Only report a change when the bar actually belongs to today's session.
    // Between sessions TradingView keeps serving the last one's numbers, so
    // without this the app folded Thursday's move into "today" all through
    // Friday, Saturday, and Sunday morning. EGX has real daily open/close
    // times, so unlike the metals it does need an explicit freshness check.
    //
    // Comparing the bar's own Cairo date beats hardcoding EGX's hours: it
    // costs nothing on public holidays or Ramadan's shortened session, both
    // of which a Sun-Thu 10:00-14:30 rule would wrongly call "open".
    const tradedToday = isEgxSessionToday(barTime);
    const change      = tradedToday ? round2(changeAbs) : 0;
    const changePct2  = tradedToday ? round2(changePct) : 0;
    results.push({
      symbol,
      name:          EGX_NAMES[symbol] ?? name,
      price:         round2(close),
      previousClose: round2(close - change),
      change,
      changePercent: changePct2,
      sessionLive:   tradedToday,
      totalDebt:     totalDebt ?? undefined,
      volume:        volume ?? undefined,
      marketCap:     marketCap ?? undefined,
      high52w:       high52w ?? undefined,
      low52w:        low52w ?? undefined,
      pe:            pe != null ? round2(pe) : undefined,
      dividendYield: divYield != null ? round2(divYield) : undefined,
      sector:            sector ?? undefined,
      epsTtm:            epsTtm != null ? round2(epsTtm) : undefined,
      revenueGrowthYoy:  revenueGrowthYoy != null ? round2(revenueGrowthYoy) : undefined,
      netMargin:         netMargin != null ? round2(netMargin) : undefined,
      roe:               roe != null ? round2(roe) : undefined,
      debtToEquity:      debtToEquity != null ? round2(debtToEquity) : undefined,
      priceToBook:       priceToBook != null ? round2(priceToBook) : undefined,
      currentRatio:      currentRatio != null ? round2(currentRatio) : undefined,
      quickRatio:        quickRatio != null ? round2(quickRatio) : undefined,
      returnOnAssets:    returnOnAssets != null ? round2(returnOnAssets) : undefined,
      freeCashFlowTtm:   freeCashFlowTtm ?? undefined,
      cashAndEquivalents: cashAndEquivalents ?? undefined,
      employees:         employees ?? undefined,
    });
  }
  return results;
}

// ─── Per-stock news via TradingView's headlines API ──────────────────────────
// Same unauthenticated-but-real-provider pattern already relied on for prices
// above (scanner.tradingview.com) and metals (TVC:GOLD/SILVER) — this is
// TradingView's own news feed (Reuters, LSE regulatory releases, etc.),
// verified live against EGX:COMI, not guessed. Chosen over scraping EGX's or
// any other site directly per explicit product decision (2026-08-21): those
// sit behind active anti-bot protection (Cloudflare/F5 WAF, blocked
// robots.txt) that signals they don't want automated access — this endpoint
// doesn't.
export interface StockNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: number; // unix seconds
  url: string;
}

async function fetchStockNews(symbol: string): Promise<StockNewsItem[]> {
  const res = await safeFetch(
    `https://news-headlines.tradingview.com/v2/headlines?client=web&lang=en&symbol=EGX:${symbol}&streaming=false`,
    { headers: { "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/" } },
  );
  if (!res?.ok) throw new Error(`TV news ${res?.status}`);
  const data = await res.json() as { items?: Array<{ id: string; title: string; source: string; published: number; storyPath: string }> };
  if (!data?.items) return [];
  return data.items.slice(0, 15).map(item => ({
    id: item.id,
    title: item.title,
    source: item.source,
    publishedAt: item.published,
    url: `https://www.tradingview.com${item.storyPath}`,
  }));
}

// TradingView only. Yahoo Finance is removed by explicit product decision
// (2026-07-30) — the same policy already applied to FX (see fetchUsdToEgp):
// one trusted provider, no other source silently standing in for it. There
// is no fallback tier left; if TradingView's Egypt scanner fails, EGX prices
// come back empty rather than from a different, unvetted source.
//
// That degrade-to-empty was the stated intent but wasn't actually wired up:
// fetchEGXViaTradingView() throws on a scanner error (e.g. a 429 during a
// rate-limit window), and nothing here caught it — the throw reached the
// /markets/stocks route uncaught and came back as a 500, taking the whole
// EGX Stocks feature down instead of degrading to "no data right now."
// Metals has the equivalent problem solved via a remembered-last-good-value
// memo (see recentMetals) instead of empty — deliberately not doing that
// here too, since this comment's policy already chose empty over a stale
// number for stocks specifically; this fix only makes that policy actually
// happen instead of crashing before it can.
export async function fetchStocks(): Promise<EGXStockResponse[]> {
  try {
    const tvData = await fetchEGXViaTradingView();
    logger.info({ count: tvData.length }, "EGX stocks via TradingView scanner");
    return tvData;
  } catch (err) {
    logger.warn({ err }, "EGX stocks: TradingView scanner unreachable — returning empty rather than a fabricated or crashed response");
    return [];
  }
}

// Cache-aware wrappers around fetchPrices/fetchStocks — any caller that just
// wants "the current prices/stocks, fresh within the last 30s" (as opposed
// to a guaranteed-fresh fetch) should use these instead of calling
// fetchPrices/fetchStocks directly. The /markets/prices and /markets/stocks
// routes below inline this same check themselves (so they can also set the
// X-Cache response header); this pair exists for non-HTTP callers like
// chat.ts, which previously called fetchPrices/fetchStocks directly and so
// bypassed the cache entirely — a full uncached 281-ticker TradingView scan
// plus a fresh CIB/Wise round-trip on every single chat message, a real
// chunk of the AI assistant's per-message latency.
export async function getCachedPrices(): Promise<MarketPricesResponse> {
  const cached = pricesCache.get();
  if (cached) return cached;
  const data = await fetchPrices();
  pricesCache.set(data);
  return data;
}

export async function getCachedStocks(): Promise<EGXStockResponse[]> {
  const cached = stocksCache.get();
  if (cached) return cached;
  const data = await fetchStocks();
  stocksCache.set(data);
  return data;
}

// Used by the AI Assistant's lookup tool so it can answer about non-EGX
// names too, without duplicating the multi-provider fallback chain
// (Twelve Data -> TradingView -> Stooq) that GET /markets/global-stocks
// already has.
export async function getCachedGlobalStocks(): Promise<EGXStockResponse[]> {
  const cached = globalStocksCache.get();
  if (cached) return cached;
  const data = await fetchGlobalStocks();
  globalStocksCache.set(data);
  return data;
}

// Used by the AI Assistant's news tool — same cache the HTTP route reads,
// just called in-process instead of round-tripping through fetch().
export async function getCachedStockNews(symbol: string): Promise<StockNewsItem[]> {
  const cache = stockNewsCache(symbol);
  const cached = cache.get();
  if (cached) return cached;
  const data = await fetchStockNews(symbol);
  cache.set(data);
  return data;
}

export function isKnownEgxSymbol(symbol: string): boolean {
  return EGX_SYMBOL_SET.has(symbol.toUpperCase());
}

// ─── EGX indices (EGX30, EGX70 EWI) ────────────────────────────────────────────
// Same TradingView Egypt scanner as individual stocks, just a different pair
// of tickers, shown as their own chips above the stock list. EGX 33 Shariah
// was also requested but doesn't have live data available this way — it
// resolves in TradingView's own symbol search (it's a real, licensed index
// on their site) but returns "symbol not found" on every actual quote/scan
// endpoint tried, on every scanner region (egypt/global/cfd/america) and the
// single-symbol quote endpoint too. Rather than guess at another symbol
// string or fabricate a number, it's left out entirely — shipping a fake or
// stale Shariah figure would be worse than not having the chip.
// [close, change_abs, change%, volume, time]
type IndexRow = [number, number, number, number | null, number | null];

const EGX_INDICES = [
  { symbol: "EGX30", name: "EGX 30" },
  { symbol: "EGX70EWI", name: "EGX 70 EWI" },
] as const;

async function fetchEGXIndices(): Promise<EGXStockResponse[]> {
  const body = JSON.stringify({
    // "time" last — same session-freshness check as individual stocks.
    columns: ["close", "change_abs", "change", "volume", "time"],
    symbols: { tickers: EGX_INDICES.map(i => `EGX:${i.symbol}`) },
  });
  const res = await safeFetch("https://scanner.tradingview.com/egypt/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://www.tradingview.com" },
    body,
  });
  const data = await safeJson<{ data: Array<{ s: string; d: IndexRow }> }>(
    res, "EGX indices TradingView"
  );
  if (!data?.data) return [];

  const bySymbol: Record<string, IndexRow> = {};
  for (const item of data.data) bySymbol[item.s.replace(/^EGX:/, "")] = item.d;

  const results: EGXStockResponse[] = [];
  for (const { symbol, name } of EGX_INDICES) {
    const d = bySymbol[symbol];
    if (!d) continue;
    const [close, changeAbs, changePct, volume, barTime] = d;
    if (!close) continue;
    const tradedToday = isEgxSessionToday(barTime);
    const change = tradedToday ? round2(changeAbs) : 0;
    results.push({
      symbol, name,
      price: round2(close), previousClose: round2(close - change),
      change, changePercent: tradedToday ? round2(changePct) : 0,
      sessionLive: tradedToday,
      volume: volume ?? undefined,
    });
  }
  return results;
}

/** Fetch US stock quotes via TradingView's America scanner. */
async function fetchGlobalStocksViaTradingView(): Promise<EGXStockResponse[]> {
  const tickers = GLOBAL_TICKERS.map(t => `${GLOBAL_EXCHANGE[t.symbol]}:${t.symbol}`);
  const res = await safeFetch("https://scanner.tradingview.com/america/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://www.tradingview.com" },
    body: JSON.stringify({ symbols: { tickers }, columns: ["close", "change_abs", "change"] }),
  });
  const data = await safeJson<{ data: Array<{ s: string; d: [number, number, number] }> }>(
    res, "Global stocks TradingView"
  );
  const rows = data?.data ?? [];
  if (rows.length === 0) {
    logger.warn("Global stocks: TradingView scanner returned no data");
    return [];
  }
  const bySymbol = new Map(rows.map(r => [r.s.split(":")[1], r.d]));
  return GLOBAL_TICKERS.map(t => {
    const d = bySymbol.get(t.symbol);
    if (!d || !(d[0] > 0)) {
      return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };
    }
    const [close, changeAbs, changePct] = d;
    return {
      symbol: t.symbol, name: t.name,
      price: round2(close), previousClose: round2(close - changeAbs),
      change: round2(changeAbs), changePercent: round2(changePct),
    };
  });
}

// ─── Twelve Data — primary live source for US stocks ─────────────────────────
// Free tier: 800 credits/day; each symbol = 1 credit; batch call = Σ symbols.
// With 20 symbols and 5-min cache: ~40 fetches/day = 800 credits/day (at the limit).

async function fetchGlobalStocksViaTwelveData(): Promise<EGXStockResponse[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) { logger.warn("TWELVE_DATA_API_KEY not set"); return []; }

  const symbols = GLOBAL_TICKERS.map(t => t.symbol).join(",");
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
  const res = await safeFetch(url, { headers: { Accept: "application/json" } });
  if (!res?.ok) {
    logger.warn({ status: res?.status }, "Twelve Data: non-OK response");
    return [];
  }

  const data = await res.json() as Record<string, any>;

  // Top-level error (bad key, quota exceeded, etc.)
  if (data?.status === "error" || data?.code) {
    logger.warn({ code: data?.code, message: data?.message }, "Twelve Data: API error");
    return [];
  }

  // Single-symbol response comes back as a flat object; multi-symbol is keyed by ticker
  const isSingle = GLOBAL_TICKERS.length === 1;

  return GLOBAL_TICKERS.map(t => {
    const q = isSingle ? data : data[t.symbol];
    if (!q || q.status === "error" || !q.close) {
      return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };
    }
    return {
      symbol:        t.symbol,
      name:          t.name,
      price:         round2(parseFloat(q.close)),
      previousClose: round2(parseFloat(q.previous_close ?? "0")),
      change:        round2(parseFloat(q.change ?? "0")),
      changePercent: round2(parseFloat(q.percent_change ?? "0")),
    };
  });
}

// ─── Stooq fallback for US stocks (truly free, no API key, different IP allowance) ──

async function fetchGlobalStocksViaStooq(): Promise<EGXStockResponse[]> {
  // Stooq format: f=sd2t2ohlcv → Symbol,Date,Time,Open,High,Low,Close,Volume
  // Each symbol needs its own request; run in parallel.
  const rows = await Promise.all(
    GLOBAL_TICKERS.map(async t => {
      const sym = t.symbol.toLowerCase() + ".us"; // e.g., AAPL → aapl.us
      const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`;
      const res = await safeFetch(url, {
        headers: { "User-Agent": BASE_HEADERS["User-Agent"], Accept: "text/csv,text/plain" },
      });
      if (!res?.ok) return null;
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) return null;
      const parts = lines[1].split(","); // skip header row
      // parts: [Symbol, Date, Time, Open, High, Low, Close, Volume]
      const open  = parseFloat(parts[3]);
      const close = parseFloat(parts[6]);
      if (!close || isNaN(close) || close <= 0) return null;
      const change       = round2(close - open);
      const changePercent = open > 0 ? round2((change / open) * 100) : 0;
      return {
        symbol: t.symbol, name: t.name,
        price: round2(close), previousClose: round2(open),
        change, changePercent,
      } as EGXStockResponse;
    })
  );
  const valid = rows.filter((r): r is EGXStockResponse => r !== null);
  logger.info({ count: valid.length }, "Global stocks via Stooq");
  return valid;
}

async function fetchGlobalStocks(): Promise<EGXStockResponse[]> {
  // 1. Twelve Data — authenticated, proper change vs previous close
  try {
    const data = await fetchGlobalStocksViaTwelveData();
    if (data.some(s => s.price > 0)) {
      logger.info("Global stocks via Twelve Data");
      return data;
    }
  } catch (err) {
    logger.warn({ err }, "Global stocks: Twelve Data failed");
  }

  // 2. TradingView — same provider already trusted for gold, silver and EGX.
  //    Replaces the Yahoo Finance quote/spark tiers removed here (2026-07-30):
  //    no other provider silently stands in when Twelve Data is unavailable.
  try {
    const data = await fetchGlobalStocksViaTradingView();
    if (data.some(s => s.price > 0)) {
      logger.info("Global stocks via TradingView");
      return data;
    }
  } catch (err) {
    logger.warn({ err }, "Global stocks: TradingView failed");
  }

  // 3. Stooq — independent provider, free, no key
  try {
    const data = await fetchGlobalStocksViaStooq();
    if (data.length > 0) return data;
  } catch (err) {
    logger.warn({ err }, "Global stocks: all sources failed");
  }

  return [];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/markets/prices", async (req, res) => {
  const cached = pricesCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchPrices();
    pricesCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market prices");
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// Shariah screening reference data — the EGX33 constituent list and the
// screening thresholds. Served rather than bundled so a rebalance is a
// redeploy instead of an app release; see lib/shariahScreening.ts for why it
// is hand-maintained and which AAOIFI screens are and aren't possible here.
// Static per deploy, so no cache and no upstream call.
router.get("/markets/shariah", (_req, res) => {
  res.json(shariahScreeningReference());
});

router.get("/markets/stocks", async (req, res) => {
  const cached = stocksCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchStocks();
    stocksCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch EGX stocks");
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

router.get("/markets/stock-news", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").toUpperCase();
  if (!EGX_SYMBOL_SET.has(symbol)) {
    res.status(400).json({ error: "Unknown or missing symbol" });
    return;
  }
  const cache = stockNewsCache(symbol);
  const cached = cache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchStockNews(symbol);
    cache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err, symbol }, "Failed to fetch stock news");
    res.status(500).json({ error: "Failed to fetch stock news" });
  }
});

router.get("/markets/egx-indices", async (req, res) => {
  const cached = egxIndicesCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchEGXIndices();
    egxIndicesCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch EGX indices");
    res.status(500).json({ error: "Failed to fetch EGX indices" });
  }
});

router.get("/markets/global-stocks", async (req, res) => {
  const cached = globalStocksCache.get();
  if (cached) { res.setHeader("X-Cache", "HIT"); res.json(cached); return; }
  try {
    const data = await fetchGlobalStocks();
    globalStocksCache.set(data);
    res.setHeader("X-Cache", "MISS");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch global stocks");
    res.status(500).json({ error: "Failed to fetch global stocks" });
  }
});

// GET /markets/real-estate — scraped Property Finder averages per area,
// refreshed twice a day by realEstatePriceCron.ts.
//
// Areas without a completed scrape return null prices, NOT the curated
// RE_PRICES figures they used to fall back to. Those estimates measured
// ~4x below reality (curated median ~13,000 EGP/m² against scraped New
// Cairo 5th Settlement at ~62,000 from 296 real listings), so serving them
// stated a confident, precise, wrong price — and, via the compound route's
// area fallback, was the source of the "Palm Hills ≈ 16k" figure. A null
// the client renders as "no data yet" is the honest answer; the curated
// list still supplies each area's real id/name/governorate.
router.get("/markets/real-estate", async (req, res) => {
  try {
    const rows = await db.select().from(realEstatePricesTable);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const data = RE_PRICES.map((area) => {
      const scraped = byId.get(area.id);
      if (scraped) {
        return {
          id: scraped.id,
          governorate: scraped.governorate,
          area: scraped.area,
          minPricePerM2: scraped.minPricePerM2,
          maxPricePerM2: scraped.maxPricePerM2,
          avgPricePerM2: scraped.avgPricePerM2,
          changePercent: scraped.changePercent,
          sampleSize: scraped.sampleSize,
          type: scraped.type,
          isLive: true,
          updatedAt: scraped.updatedAt,
        };
      }
      return {
        id: area.id,
        governorate: area.governorate,
        area: area.area,
        minPricePerM2: null,
        maxPricePerM2: null,
        avgPricePerM2: null,
        changePercent: null,
        sampleSize: 0,
        type: area.type,
        isLive: false,
        updatedAt: null,
      };
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch real estate prices");
    res.status(500).json({ error: "Failed to fetch real estate prices" });
  }
});

// GET /markets/real-estate/compounds — individual developments with
// developer attribution. Property Finder exposes no developer field
// anywhere scrapable, so the compound/developer pairing itself is curated
// (RE_COMPOUNDS) and only its live PRICE comes from the scraper. Fallback
// chain, most-honest-available-number first: (1) this compound's own live
// scrape, (2) its linked area's own genuine price (live or that area's own
// curated estimate) tagged as borrowed, (3) no number at all. Never an
// invented compound-specific figure.
router.get("/markets/real-estate/compounds", async (req, res) => {
  try {
    const [compoundRows, areaRows] = await Promise.all([
      db.select().from(realEstateCompoundPricesTable),
      db.select().from(realEstatePricesTable),
    ]);
    const compoundById = new Map(compoundRows.map((r) => [r.id, r]));
    const areaById = new Map(areaRows.map((r) => [r.id, r]));

    const data = RE_COMPOUNDS.map((c) => {
      const scraped = compoundById.get(c.id);
      if (scraped) {
        return {
          id: c.id,
          name: c.name,
          developer: c.developer,
          governorate: c.governorate,
          minPricePerM2: scraped.minPricePerM2,
          maxPricePerM2: scraped.maxPricePerM2,
          avgPricePerM2: scraped.avgPricePerM2,
          changePercent: scraped.changePercent,
          sampleSize: scraped.sampleSize,
          type: c.type,
          isLive: true,
          priceSource: "compound" as const,
          areaLabel: null as string | null,
          updatedAt: scraped.updatedAt,
        };
      }

      // Only a genuinely scraped parent area may stand in — the curated
      // static estimates are ~4x below real listing prices and were exactly
      // what made Palm Hills read ≈16k EGP/m². A compound with no live
      // scrape and no live parent area now reports no number at all.
      const liveArea = c.areaId ? areaById.get(c.areaId) : undefined;
      if (liveArea) {
        const avgPricePerM2 = liveArea.avgPricePerM2;
        const minPricePerM2 = liveArea.minPricePerM2;
        const maxPricePerM2 = liveArea.maxPricePerM2;
        return {
          id: c.id,
          name: c.name,
          developer: c.developer,
          governorate: c.governorate,
          minPricePerM2,
          maxPricePerM2,
          avgPricePerM2,
          changePercent: null,
          sampleSize: 0,
          type: c.type,
          isLive: false,
          priceSource: "area_estimate" as const,
          areaLabel: liveArea.area,
          updatedAt: liveArea.updatedAt,
        };
      }

      return {
        id: c.id,
        name: c.name,
        developer: c.developer,
        governorate: c.governorate,
        minPricePerM2: null,
        maxPricePerM2: null,
        avgPricePerM2: null,
        changePercent: null,
        sampleSize: 0,
        type: c.type,
        isLive: false,
        priceSource: "none" as const,
        areaLabel: null,
        updatedAt: null,
      };
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch real estate compound prices");
    res.status(500).json({ error: "Failed to fetch real estate compound prices" });
  }
});

export default router;
