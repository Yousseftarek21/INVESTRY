import { Router, type IRouter } from "express";
import { lt, desc, eq } from "drizzle-orm";
import { db, marketCloseSnapshotsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { cairoDateString } from "../lib/cairoDate";

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
const stocksCache    = makeCache<EGXStockResponse[]>(30_000);     // 30 s
const globalStocksCache = makeCache<EGXStockResponse[]>(5 * 60_000); // 5 min (Twelve Data free tier)
const egxIndicesCache = makeCache<EGXStockResponse[]>(30_000);    // 30 s

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
  { yahoo: "COMI.CA",   symbol: "COMI",   name: "Commercial International Bank (CIB)"          },
  { yahoo: "CIEB.CA",   symbol: "CIEB",   name: "Credit Agricole Egypt"                        },
  { yahoo: "ADIB.CA",   symbol: "ADIB",   name: "Abu Dhabi Islamic Bank Egypt"                 },
  { yahoo: "HDBK.CA",   symbol: "HDBK",   name: "Housing & Development Bank"                   },
  { yahoo: "QNBE.CA",   symbol: "QNBE",   name: "QNB Alahli"                                   },
  { yahoo: "NBKE.CA",   symbol: "NBKE",   name: "National Bank of Kuwait Egypt"                },
  { yahoo: "CANA.CA",   symbol: "CANA",   name: "Suez Canal Bank"                              },
  { yahoo: "SAIB.CA",   symbol: "SAIB",   name: "Societe Arabe Internationale de Banque"       },
  { yahoo: "UBEE.CA",   symbol: "UBEE",   name: "United Bank"                                  },
  { yahoo: "EXPA.CA",   symbol: "EXPA",   name: "Export Development Bank of Egypt"             },
  { yahoo: "EGBE.CA",   symbol: "EGBE",   name: "Egyptian Gulf Bank"                           },
  { yahoo: "FAIT.CA",   symbol: "FAIT",   name: "Faisal Islamic Bank of Egypt"                 },
  { yahoo: "FAITA.CA",  symbol: "FAITA",  name: "Faisal Islamic Bank of Egypt (B Shares)"      },
  // Financial Services (47)
  { yahoo: "HRHO.CA",   symbol: "HRHO",   name: "EFG Holding"                                  },
  { yahoo: "CICH.CA",   symbol: "CICH",   name: "CI Capital Holding"                           },
  { yahoo: "EFIC.CA",   symbol: "EFIC",   name: "Egyptian Financial & Industrial Co."          },
  { yahoo: "GBCO.CA",   symbol: "GBCO",   name: "GB Corp"                                      },
  { yahoo: "CCAP.CA",   symbol: "CCAP",   name: "QALA For Financial Investments"               },
  { yahoo: "BINV.CA",   symbol: "BINV",   name: "B Investments Holding"                        },
  { yahoo: "BTFH.CA",   symbol: "BTFH",   name: "Beltone Holding"                              },
  { yahoo: "CNFN.CA",   symbol: "CNFN",   name: "Contact Financial Holding"                    },
  { yahoo: "ACTF.CA",   symbol: "ACTF",   name: "Act Financial"                                },
  { yahoo: "ASPI.CA",   symbol: "ASPI",   name: "Aspire Capital Holding"                       },
  { yahoo: "ATLC.CA",   symbol: "ATLC",   name: "Al Tawfeek Leasing"                           },
  { yahoo: "VALU.CA",   symbol: "VALU",   name: "U Consumer Finance"                           },
  { yahoo: "RAYA.CA",   symbol: "RAYA",   name: "Raya Holding for Financial Investments"       },
  { yahoo: "ICLE.CA",   symbol: "ICLE",   name: "International Co. for Leasing"                },
  { yahoo: "ICFC.CA",   symbol: "ICFC",   name: "International Co. for Fertilizers & Chemicals"},
  { yahoo: "MKIT.CA",   symbol: "MKIT",   name: "Misr Kuwait Investment & Trading"             },
  { yahoo: "KWIN.CA",   symbol: "KWIN",   name: "El Kahera El Watania Investment"               },
  { yahoo: "NAHO.CA",   symbol: "NAHO",   name: "Naeem Holding"                                },
  { yahoo: "ODIN.CA",   symbol: "ODIN",   name: "ODIN Investments"                             },
  { yahoo: "OFH.CA",    symbol: "OFH",    name: "OB Financial Holding"                         },
  { yahoo: "OIH.CA",    symbol: "OIH",    name: "Orascom Investment Holding"                   },
  { yahoo: "PRMH.CA",   symbol: "PRMH",   name: "Prime Holding"                                },
  { yahoo: "RKAZ.CA",   symbol: "RKAZ",   name: "REKAZ Financial Holding"                      },
  { yahoo: "TYCN.CA",   symbol: "TYCN",   name: "Tycoon Holding"                               },
  { yahoo: "TWSA.CA",   symbol: "TWSA",   name: "TAWASOA For Factoring"                        },
  { yahoo: "GRCA.CA",   symbol: "GRCA",   name: "Grand Investment Capital"                     },
  { yahoo: "HAVC.CA",   symbol: "HAVC",   name: "Hassan Allam Investments & Venture Capital"   },
  { yahoo: "LKGP.CA",   symbol: "LKGP",   name: "Lakah Group Holding"                          },
  { yahoo: "SEIG.CA",   symbol: "SEIG",   name: "Saudi Egyptian Investment & Finance"          },
  { yahoo: "SEIGA.CA",  symbol: "SEIGA",  name: "Saudi Egyptian Investment & Finance (A)"      },
  { yahoo: "VLMR.CA",   symbol: "VLMR",   name: "Valmore Holding"                              },
  { yahoo: "VLMRA.CA",  symbol: "VLMRA",  name: "Valmore Holding (A)"                          },
  { yahoo: "OCAP.CA",   symbol: "OCAP",   name: "OG Capital For Investments"                   },
  { yahoo: "EASB.CA",   symbol: "EASB",   name: "Egyptian Arabian Securities Brokerage"        },
  { yahoo: "EBSC.CA",   symbol: "EBSC",   name: "Osool ESB Securities Brokerage"               },
  { yahoo: "EOSB.CA",   symbol: "EOSB",   name: "El Orouba Securities Brokerage"               },
  { yahoo: "ACAMD.CA",  symbol: "ACAMD",  name: "Arab Co. for Asset Management & Development"  },
  { yahoo: "ACAP.CA",   symbol: "ACAP",   name: "A Capital Holding"                            },
  { yahoo: "HDST.CA",   symbol: "HDST",   name: "HEDGESTONE INVESTMENT"                        },
  { yahoo: "AIDC.CA",   symbol: "AIDC",   name: "Arabia for Investment and Development"        },
  { yahoo: "AIH.CA",    symbol: "AIH",    name: "Arabia Investments Holding"                   },
  { yahoo: "AMIA.CA",   symbol: "AMIA",   name: "Arab Moltaqa Investments"                     },
  { yahoo: "BIGP.CA",   symbol: "BIGP",   name: "ElBarbary Investment Group"                   },
  { yahoo: "CPME.CA",   symbol: "CPME",   name: "Catalyst Partners Middle East"                },
  { yahoo: "IBCT.CA",   symbol: "IBCT",   name: "International Business Corp. for Trading"     },
  { yahoo: "KORA.CA",   symbol: "KORA",   name: "KORRA"                                        },
  { yahoo: "MAAL.CA",   symbol: "MAAL",   name: "Marseilla El Masreia El Khalegeya Holding"    },
  // Real Estate (41)
  { yahoo: "TMGH.CA",   symbol: "TMGH",   name: "Talaat Moustafa Group Holding"                },
  { yahoo: "PHDC.CA",   symbol: "PHDC",   name: "Palm Hills Development"                       },
  { yahoo: "MASR.CA",   symbol: "MASR",   name: "Madinet Masr for Housing & Development"       },
  { yahoo: "OCDI.CA",   symbol: "OCDI",   name: "SODIC"                                        },
  { yahoo: "EMFD.CA",   symbol: "EMFD",   name: "Emaar Misr for Development"                   },
  { yahoo: "ORHD.CA",   symbol: "ORHD",   name: "Orascom Development Egypt"                    },
  { yahoo: "HELI.CA",   symbol: "HELI",   name: "Heliopolis Housing"                           },
  { yahoo: "EGTS.CA",   symbol: "EGTS",   name: "Egyptian for Tourism Resorts"                 },
  { yahoo: "AMER.CA",   symbol: "AMER",   name: "Amer Group Holding"                           },
  { yahoo: "UNIT.CA",   symbol: "UNIT",   name: "United Housing Construction"                  },
  { yahoo: "ELSH.CA",   symbol: "ELSH",   name: "El Shams Housing & Development"               },
  { yahoo: "EHDR.CA",   symbol: "EHDR",   name: "Egyptians Housing Development & Reconstruction"},
  { yahoo: "IDRE.CA",   symbol: "IDRE",   name: "Ismailia Development & Real Estate"           },
  { yahoo: "ZMID.CA",   symbol: "ZMID",   name: "Zahraa Maadi Investment & Development"        },
  { yahoo: "RREI.CA",   symbol: "RREI",   name: "Arab Real Estate Investment Co."              },
  { yahoo: "MENA.CA",   symbol: "MENA",   name: "Mena Touristic & Real Estate Investment"      },
  { yahoo: "RTVC.CA",   symbol: "RTVC",   name: "Remco for Touristic Villages Construction"    },
  { yahoo: "AREH.CA",   symbol: "AREH",   name: "Egyptian Real Estate Group"                   },
  { yahoo: "BONY.CA",   symbol: "BONY",   name: "Bonyan for Development and Trade"             },
  { yahoo: "CCRS.CA",   symbol: "CCRS",   name: "Gulf Canadian Real Estate Investment"         },
  { yahoo: "CRST.CA",   symbol: "CRST",   name: "Creast Mark for Real Estate Development"      },
  { yahoo: "EGREF.CA",  symbol: "EGREF",  name: "Egyptians Real Estate Fund"                   },
  { yahoo: "ELKA.CA",   symbol: "ELKA",   name: "El Kahera Housing"                            },
  { yahoo: "ELWA.CA",   symbol: "ELWA",   name: "Elwadi International Investment & Development"},
  { yahoo: "FIRE.CA",   symbol: "FIRE",   name: "First Investment & Real Estate Development"   },
  { yahoo: "GIHD.CA",   symbol: "GIHD",   name: "Gharbia Islamic Housing Development"          },
  { yahoo: "GPIM.CA",   symbol: "GPIM",   name: "GPI For Urban Growth"                         },
  { yahoo: "GPPL.CA",   symbol: "GPPL",   name: "Golden Pyramids Plaza"                        },
  { yahoo: "ICID.CA",   symbol: "ICID",   name: "International Co. for Investment & Development"},
  { yahoo: "MMHC.CA",   symbol: "MMHC",   name: "El Mamoura Co."                               },
  { yahoo: "NARE.CA",   symbol: "NARE",   name: "Naeem Real Estate Holding Group"              },
  { yahoo: "NHPS.CA",   symbol: "NHPS",   name: "National Housing for Professional Syndicates" },
  { yahoo: "OBRI.CA",   symbol: "OBRI",   name: "El Obour Real Estate Investment"              },
  { yahoo: "PRDC.CA",   symbol: "PRDC",   name: "Pioneers Properties for Urban Development"    },
  { yahoo: "TANM.CA",   symbol: "TANM",   name: "Tanmiya for Real Estate Investment"           },
  { yahoo: "UEGC.CA",   symbol: "UEGC",   name: "El-Saeed Contracting & Real Estate Investment"},
  { yahoo: "UTOP.CA",   symbol: "UTOP",   name: "Utopia Real Estate Investment & Tourism"      },
  { yahoo: "ADRI.CA",   symbol: "ADRI",   name: "Arab Development & Real Estate Investment"    },
  { yahoo: "GGCC.CA",   symbol: "GGCC",   name: "Giza General Contracting & Real Estate"       },
  { yahoo: "COPR.CA",   symbol: "COPR",   name: "Cooper for Commercial Investment & Real Estate"},
  { yahoo: "AFDI.CA",   symbol: "AFDI",   name: "Alahly For Development & Investment"          },
  // Hotels & Tourism (11)
  { yahoo: "EGOTH.CA",  symbol: "EGOTH",  name: "El Masreyah Tourism"                          },
  { yahoo: "EITP.CA",   symbol: "EITP",   name: "Egyptian International Tourism Projects"      },
  { yahoo: "MHOT.CA",   symbol: "MHOT",   name: "Misr Hotels"                                  },
  { yahoo: "MITR.CA",   symbol: "MITR",   name: "Misr Travel"                                  },
  { yahoo: "MMAT.CA",   symbol: "MMAT",   name: "Marsa Alam Tourism Development"               },
  { yahoo: "PHTV.CA",   symbol: "PHTV",   name: "Pyramisa Hotels"                              },
  { yahoo: "RMTV.CA",   symbol: "RMTV",   name: "Rowad Misr Tourism Investment"                },
  { yahoo: "ROTO.CA",   symbol: "ROTO",   name: "Rowad Tourism Co."                            },
  { yahoo: "SDTI.CA",   symbol: "SDTI",   name: "Sharm Dreams Tourism Investment"              },
  { yahoo: "SPHT.CA",   symbol: "SPHT",   name: "El Shams Pyramids Hotels & Tourism"           },
  { yahoo: "TRTO.CA",   symbol: "TRTO",   name: "TransOceans Tours"                            },
  // Telecommunications (2)
  { yahoo: "ETEL.CA",   symbol: "ETEL",   name: "Telecom Egypt"                                },
  { yahoo: "GTHE.CA",   symbol: "GTHE",   name: "Global Telecom Holding"                       },
  // Industrial (38)
  { yahoo: "SWDY.CA",   symbol: "SWDY",   name: "El Sewedy Electric"                           },
  { yahoo: "EAST.CA",   symbol: "EAST",   name: "Eastern Company"                              },
  { yahoo: "ORAS.CA",   symbol: "ORAS",   name: "Orascom Construction"                         },
  { yahoo: "MOIL.CA",   symbol: "MOIL",   name: "Maridive & Oil Services"                      },
  { yahoo: "EGAL.CA",   symbol: "EGAL",   name: "Egypt Aluminum"                               },
  { yahoo: "ALUM.CA",   symbol: "ALUM",   name: "Arab Aluminum"                                },
  { yahoo: "MPRC.CA",   symbol: "MPRC",   name: "Egyptian Media Production City"               },
  { yahoo: "ENGC.CA",   symbol: "ENGC",   name: "Industrial Engineering Co. for Construction"  },
  { yahoo: "ASCM.CA",   symbol: "ASCM",   name: "ASEC for Mining (Ascom)"                     },
  { yahoo: "COSG.CA",   symbol: "COSG",   name: "Cairo Oils & Soap"                            },
  { yahoo: "EEII.CA",   symbol: "EEII",   name: "El Arabia Engineering Industries"             },
  { yahoo: "ACFR.CA",   symbol: "ACFR",   name: "Alexandria Company for Refractories"          },
  { yahoo: "ANCC.CA",   symbol: "ANCC",   name: "ALNAHDA Industrial Co."                       },
  // ARVA (Arab Valves) removed — absent from TradingView scanner, no live data available.
  { yahoo: "ATQA.CA",   symbol: "ATQA",   name: "Misr National Steel"                          },
  { yahoo: "DTPP.CA",   symbol: "DTPP",   name: "Delta for Printing & Packaging"               },
  { yahoo: "ELEC.CA",   symbol: "ELEC",   name: "Electro Cable Egypt"                          },
  { yahoo: "EPPK.CA",   symbol: "EPPK",   name: "El Ahram for Printing & Packing"              },
  { yahoo: "IRON.CA",   symbol: "IRON",   name: "Egyptian Iron & Steel"                        },
  { yahoo: "IRAX.CA",   symbol: "IRAX",   name: "El Ezz Aldekhela Steel-Alexandria"            },
  { yahoo: "ISMQ.CA",   symbol: "ISMQ",   name: "Iron & Steel for Mines & Quarries"            },
  { yahoo: "MBEG.CA",   symbol: "MBEG",   name: "MB for Engineering & Contracting"             },
  { yahoo: "MISR.CA",   symbol: "MISR",   name: "MISR Intercontinental for Granite & Marble"   },
  { yahoo: "NCCW.CA",   symbol: "NCCW",   name: "Nasr Co. for Civil Works"                     },
  { yahoo: "NMIN.CA",   symbol: "NMIN",   name: "El Nasr Mining"                               },
  { yahoo: "RAKT.CA",   symbol: "RAKT",   name: "Rakta Paper Manufacturing"                    },
  { yahoo: "UNIP.CA",   symbol: "UNIP",   name: "Universal For Paper Industries"               },
  { yahoo: "SMPP.CA",   symbol: "SMPP",   name: "Modern Shorouk Printing & Packaging"          },
  { yahoo: "SINA.CA",   symbol: "SINA",   name: "Sinai Manganese Company"                      },
  { yahoo: "IEEC.CA",   symbol: "IEEC",   name: "Industrial & Engineering Enterprises"         },
  { yahoo: "CFGH.CA",   symbol: "CFGH",   name: "Concrete Fashion Group"                       },
  { yahoo: "MTIE.CA",   symbol: "MTIE",   name: "MM Group for Industry & International Trade"  },
  { yahoo: "FNAR.CA",   symbol: "FNAR",   name: "Al Fanar Contracting & Construction"          },
  { yahoo: "GDWA.CA",   symbol: "GDWA",   name: "Gadwa For Industrial Development"             },
  { yahoo: "GMCI.CA",   symbol: "GMCI",   name: "GMC Group for Industrial & Commercial"        },
  { yahoo: "YAYT.CA",   symbol: "YAYT",   name: "Spring & Transportation Needs Manufacturing"  },
  { yahoo: "EFAC.CA",   symbol: "EFAC",   name: "Egyptian Ferro Alloys"                        },
  { yahoo: "DCRC.CA",   symbol: "DCRC",   name: "Delta Construction & Rebuilding"              },
  // Chemicals & Fertilizers (12)
  { yahoo: "ABUK.CA",   symbol: "ABUK",   name: "Abu Kir Fertilizers & Chemical Industries"    },
  { yahoo: "SKPC.CA",   symbol: "SKPC",   name: "Sidi Kerir Petrochemicals"                    },
  { yahoo: "MFPC.CA",   symbol: "MFPC",   name: "Misr Fertilizers Production (MOPCO)"          },
  { yahoo: "EGCH.CA",   symbol: "EGCH",   name: "Egyptian Chemical Industries (KIMA)"          },
  { yahoo: "PACH.CA",   symbol: "PACH",   name: "Egyptian Paints (Pachin)"                     },
  { yahoo: "MICH.CA",   symbol: "MICH",   name: "Misr Chemical Industries"                     },
  { yahoo: "SMFR.CA",   symbol: "SMFR",   name: "Samad Misr (EGYFERT)"                         },
  { yahoo: "KZPC.CA",   symbol: "KZPC",   name: "Kafr El Zayat Pesticides & Chemical"          },
  { yahoo: "NFCI.CA",   symbol: "NFCI",   name: "ELNASR Co For Fertilizers & Chemicals"        },
  { yahoo: "ELAB.CA",   symbol: "ELAB",   name: "Egyptian Linear Alkyl Benzene (ELAB)"         },
  { yahoo: "CID.CA",    symbol: "CID",    name: "Chemical & Industrial Development"             },
  { yahoo: "MOSC.CA",   symbol: "MOSC",   name: "Misr Oils & Soap"                             },
  // Energy (8)
  { yahoo: "AMOC.CA",   symbol: "AMOC",   name: "Alexandria Mineral Oils"                      },
  { yahoo: "INEG.CA",   symbol: "INEG",   name: "Integrated Engineering Group"                 },
  { yahoo: "NDRL.CA",   symbol: "NDRL",   name: "National Drilling Company"                    },
  { yahoo: "PMSC.CA",   symbol: "PMSC",   name: "Petroleum Marine Services"                    },
  { yahoo: "TAQA.CA",   symbol: "TAQA",   name: "TAQA Arabia"                                  },
  { yahoo: "EGAS.CA",   symbol: "EGAS",   name: "Egypt Gas Co."                                },
  { yahoo: "ENPI.CA",   symbol: "ENPI",   name: "Engineering for Petroleum (Enppi)"            },
  { yahoo: "GSSC.CA",   symbol: "GSSC",   name: "General Silos & Storage"                      },
  // Construction Materials (17)
  { yahoo: "SUCE.CA",   symbol: "SUCE",   name: "Suez Cement"                                  },
  { yahoo: "MCQE.CA",   symbol: "MCQE",   name: "Misr Cement (Qena)"                           },
  { yahoo: "LCSW.CA",   symbol: "LCSW",   name: "Lecico Egypt"                                 },
  { yahoo: "CERA.CA",   symbol: "CERA",   name: "Arab Ceramic (Ceramica Remas)"                },
  { yahoo: "SCEM.CA",   symbol: "SCEM",   name: "Sinai Cement"                                 },
  { yahoo: "SVCE.CA",   symbol: "SVCE",   name: "South Valley Cement"                          },
  { yahoo: "ARCC.CA",   symbol: "ARCC",   name: "Arabian Cement Company"                       },
  { yahoo: "ALEX.CA",   symbol: "ALEX",   name: "Alexandria Cement"                            },
  { yahoo: "MBSC.CA",   symbol: "MBSC",   name: "Misr Beni Suef Cement"                        },
  { yahoo: "TORA.CA",   symbol: "TORA",   name: "Tourah Cement"                                },
  { yahoo: "ECAP.CA",   symbol: "ECAP",   name: "El Ezz Ceramics & Porcelain (Gemma)"          },
  { yahoo: "MEGM.CA",   symbol: "MEGM",   name: "Middle East Glass Manufacturing"               },
  { yahoo: "PRCL.CA",   symbol: "PRCL",   name: "General Co. for Ceramic & Porcelain"          },
  { yahoo: "RUBX.CA",   symbol: "RUBX",   name: "Rubex International for Plastic & Acrylic"    },
  { yahoo: "WATP.CA",   symbol: "WATP",   name: "Modern Co. for Water Proofing"                },
  { yahoo: "SIEG.CA",   symbol: "SIEG",   name: "Egyptian Co. for Pipes & Cement Products"     },
  { yahoo: "KNGC.CA",   symbol: "KNGC",   name: "El Nasr Glass and Crystal"                    },
  // Healthcare (21)
  { yahoo: "CLHO.CA",   symbol: "CLHO",   name: "Cleopatra Hospital Group"                     },
  { yahoo: "PHAR.CA",   symbol: "PHAR",   name: "EIPICO"                                       },
  { yahoo: "SPMD.CA",   symbol: "SPMD",   name: "Speed Medical"                                },
  { yahoo: "RMDA.CA",   symbol: "RMDA",   name: "Rameda Pharmaceutical"                        },
  { yahoo: "ISPH.CA",   symbol: "ISPH",   name: "Ibn Sina Pharma"                              },
  { yahoo: "ADCI.CA",   symbol: "ADCI",   name: "Arab Pharmaceuticals"                         },
  { yahoo: "AMES.CA",   symbol: "AMES",   name: "Alexandria New Medical Center"                },
  { yahoo: "APPC.CA",   symbol: "APPC",   name: "Advanced Pharmaceutical Packaging"            },
  { yahoo: "AXPH.CA",   symbol: "AXPH",   name: "Alexandria Pharmaceuticals & Chemical"        },
  { yahoo: "BIOC.CA",   symbol: "BIOC",   name: "GlaxoSmithKline Egypt"                        },
  { yahoo: "FCMD.CA",   symbol: "FCMD",   name: "Future Care for Medical Industries"           },
  { yahoo: "MCRO.CA",   symbol: "MCRO",   name: "Macro Group Pharmaceutical"                   },
  { yahoo: "MEPA.CA",   symbol: "MEPA",   name: "Medical Packaging Co."                        },
  { yahoo: "MIPH.CA",   symbol: "MIPH",   name: "Minapharm Pharmaceuticals"                    },
  { yahoo: "MPCI.CA",   symbol: "MPCI",   name: "Memphis Pharmaceutical & Chemical"            },
  { yahoo: "NIPH.CA",   symbol: "NIPH",   name: "El-Nile Pharmaceuticals & Chemical"           },
  { yahoo: "OCPH.CA",   symbol: "OCPH",   name: "October Pharma"                               },
  { yahoo: "SIPC.CA",   symbol: "SIPC",   name: "Sabaa International for Pharmaceutical"       },
  { yahoo: "UPMS.CA",   symbol: "UPMS",   name: "Union Pharmacist for Medical Services"        },
  { yahoo: "NINH.CA",   symbol: "NINH",   name: "Nozha International Hospital"                 },
  { yahoo: "CPCI.CA",   symbol: "CPCI",   name: "Kahira Pharmaceuticals & Chemical"            },
  // Food & Beverage (28)
  { yahoo: "JUFO.CA",   symbol: "JUFO",   name: "Juhayna Food Industries"                      },
  { yahoo: "DOMT.CA",   symbol: "DOMT",   name: "Arabian Food Industries (Domty)"              },
  { yahoo: "EFID.CA",   symbol: "EFID",   name: "Edita Food Industries"                        },
  { yahoo: "POUL.CA",   symbol: "POUL",   name: "Cairo Poultry Group"                          },
  { yahoo: "AJWA.CA",   symbol: "AJWA",   name: "Ajwa Group for Food Industries Egypt"         },
  { yahoo: "ISMA.CA",   symbol: "ISMA",   name: "Ismailia Misr Poultry"                        },
  { yahoo: "IFAP.CA",   symbol: "IFAP",   name: "International Agricultural Products"          },
  { yahoo: "OLFI.CA",   symbol: "OLFI",   name: "Obour Land for Food Industries"               },
  { yahoo: "INFI.CA",   symbol: "INFI",   name: "Ismailia National Food Industries"            },
  { yahoo: "SUGR.CA",   symbol: "SUGR",   name: "Delta Sugar"                                  },
  { yahoo: "AFMC.CA",   symbol: "AFMC",   name: "Alexandria Flour Mills"                       },
  { yahoo: "MILS.CA",   symbol: "MILS",   name: "North Cairo Mills"                            },
  { yahoo: "SCFM.CA",   symbol: "SCFM",   name: "South Cairo & Giza Mills"                     },
  { yahoo: "WCDF.CA",   symbol: "WCDF",   name: "Middle & West Delta Flour Mills"               },
  { yahoo: "UEFM.CA",   symbol: "UEFM",   name: "Upper Egypt Flour Mills"                      },
  { yahoo: "EDFM.CA",   symbol: "EDFM",   name: "East Delta Flour Mills"                       },
  { yahoo: "CEFM.CA",   symbol: "CEFM",   name: "Middle Egypt Flour Mills"                     },
  { yahoo: "SNFC.CA",   symbol: "SNFC",   name: "Sharkia National Food"                        },
  { yahoo: "SNFI.CA",   symbol: "SNFI",   name: "Souhag National Food Industries"              },
  { yahoo: "EPCO.CA",   symbol: "EPCO",   name: "Egypt for Poultry Co."                        },
  { yahoo: "MPCO.CA",   symbol: "MPCO",   name: "Mansourah Poultry"                            },
  { yahoo: "GOUR.CA",   symbol: "GOUR",   name: "Gourmet Egypt Foods"                          },
  { yahoo: "ZEOT.CA",   symbol: "ZEOT",   name: "Extracted Oils & Derivatives"                 },
  { yahoo: "ADPC.CA",   symbol: "ADPC",   name: "Arab Dairy Products (Panda)"                  },
  { yahoo: "AIFI.CA",   symbol: "AIFI",   name: "Atlas for Investment & Food Industries"       },
  { yahoo: "ELNA.CA",   symbol: "ELNA",   name: "El Nasr for Manufacturing Agricultural Crops" },
  { yahoo: "MFSC.CA",   symbol: "MFSC",   name: "Misr Duty Free Shops"                         },
  { yahoo: "KABO.CA",   symbol: "KABO",   name: "El Nasr Clothing & Textiles"                  },
  // Technology (10)
  { yahoo: "FWRY.CA",   symbol: "FWRY",   name: "Fawry for Banking Technology & Electronic Payment"},
  { yahoo: "EFIH.CA",   symbol: "EFIH",   name: "e-finance for Digital & Financial Investments" },
  { yahoo: "VERT.CA",   symbol: "VERT",   name: "Vertika for Industry & Trade"                 },
  { yahoo: "RACC.CA",   symbol: "RACC",   name: "Raya Contact Center"                          },
  { yahoo: "AMPI.CA",   symbol: "AMPI",   name: "AL Moasher Pay for Electronic Payment"        },
  { yahoo: "DGTZ.CA",   symbol: "DGTZ",   name: "Digitize for Investment & Technology"         },
  { yahoo: "EGSA.CA",   symbol: "EGSA",   name: "Egyptian Satellite Co."                       },
  { yahoo: "SCTS.CA",   symbol: "SCTS",   name: "Suez Canal Co. for Technology Settling"       },
  { yahoo: "FTNS.CA",   symbol: "FTNS",   name: "Fitness Prime"                                },
  { yahoo: "GEOS.CA",   symbol: "GEOS",   name: "Geos for Trading and Contracting"             },
  // Textile (9)
  { yahoo: "ORWE.CA",   symbol: "ORWE",   name: "Oriental Weavers Carpet"                      },
  { yahoo: "DSCW.CA",   symbol: "DSCW",   name: "Dice Sport & Casual Wear Manufacturers"       },
  { yahoo: "ACGC.CA",   symbol: "ACGC",   name: "Arab Cotton Ginning"                          },
  { yahoo: "APSW.CA",   symbol: "APSW",   name: "Arab Polvara Spinning & Weaving"              },
  { yahoo: "GTWL.CA",   symbol: "GTWL",   name: "Golden Textiles & Clothes Wool"               },
  { yahoo: "NCGC.CA",   symbol: "NCGC",   name: "Nile Cotton Ginning"                          },
  { yahoo: "SPIN.CA",   symbol: "SPIN",   name: "Alexandria Spinning & Weaving"                },
  { yahoo: "GTEX.CA",   symbol: "GTEX",   name: "G-TEX for Commercial and Industrial"          },
  // Agriculture (7)
  { yahoo: "AALR.CA",   symbol: "AALR",   name: "General Co. for Land Reclamation"             },
  { yahoo: "EALR.CA",   symbol: "EALR",   name: "El Arabia for Land Reclamation"               },
  { yahoo: "GGRN.CA",   symbol: "GGRN",   name: "Gogreen Agricultural Investment"              },
  { yahoo: "KRDI.CA",   symbol: "KRDI",   name: "Al Khair River for Agricultural Development"  },
  { yahoo: "LUTS.CA",   symbol: "LUTS",   name: "Lotus Agricultural Investments"               },
  { yahoo: "NEDA.CA",   symbol: "NEDA",   name: "Northern Upper Egypt Development & Agricultural"},
  { yahoo: "WKOL.CA",   symbol: "WKOL",   name: "Wadi Kom Ombo Land Reclamation"               },
  // 4 additional stocks confirmed in TradingView scanner
  { yahoo: "SAUD.CA",   symbol: "SAUD",   name: "Al Baraka Bank Egypt"                         },
  { yahoo: "ARAB.CA",   symbol: "ARAB",   name: "Arab Developers Holding"                      },
  { yahoo: "DAPH.CA",   symbol: "DAPH",   name: "Development & Engineering Consultants"        },
  { yahoo: "HBCO.CA",   symbol: "HBCO",   name: "Heibco"                                       },
  // Insurance (3)
  { yahoo: "DEIN.CA",   symbol: "DEIN",   name: "Delta Insurance"                              },
  { yahoo: "MOIN.CA",   symbol: "MOIN",   name: "Mohandes Insurance"                           },
  { yahoo: "MLIC.CA",   symbol: "MLIC",   name: "Misr Life Insurance"                          },
  // Education (5)
  { yahoo: "CIRA.CA",   symbol: "CIRA",   name: "CIRA Education"                               },
  { yahoo: "CAED.CA",   symbol: "CAED",   name: "Cairo Educational Services"                   },
  { yahoo: "EEP.CA",    symbol: "EEP",    name: "Egypt Education Platform"                     },
  { yahoo: "TALM.CA",   symbol: "TALM",   name: "Taaleem Management Services"                  },
  { yahoo: "MOED.CA",   symbol: "MOED",   name: "Egyptian Modern Education Systems"            },
  // Transportation (7)
  { yahoo: "ALCN.CA",   symbol: "ALCN",   name: "Alexandria Container & Cargo Handling"        },
  { yahoo: "ETRS.CA",   symbol: "ETRS",   name: "Egyptian Transport (Egytrans)"                },
  { yahoo: "CSAG.CA",   symbol: "CSAG",   name: "Canal Shipping Agencies"                      },
  { yahoo: "DCCC.CA",   symbol: "DCCC",   name: "Damietta Container & Cargo Handling"          },
  { yahoo: "POCO.CA",   symbol: "POCO",   name: "Port Said Container & Cargo Handling"         },
  { yahoo: "EGWA.CA",   symbol: "EGWA",   name: "General Warehouses of Egypt"                  },
  { yahoo: "BIDI.CA",   symbol: "BIDI",   name: "El Badr Investment and Development"           },
];

// ─── Global stock ticker list — 8 symbols, fits Twelve Data free tier (8 credits/min) ───
// `yahoo` is a historical field name — Yahoo Finance is no longer used anywhere
// (2026-07-30); it's kept only because Twelve Data and Stooq both index by this
// same plain ticker string, so renaming it would touch both without changing
// behaviour. GLOBAL_EXCHANGE below is what the TradingView fetcher uses.

const GLOBAL_TICKERS = [
  { yahoo: "SPY",   symbol: "SPY",   name: "S&P 500 (SPDR ETF)"       },
  { yahoo: "QQQ",   symbol: "QQQ",   name: "NASDAQ 100 (Invesco ETF)" },
  { yahoo: "AAPL",  symbol: "AAPL",  name: "Apple Inc."               },
  { yahoo: "MSFT",  symbol: "MSFT",  name: "Microsoft Corp."          },
  { yahoo: "NVDA",  symbol: "NVDA",  name: "NVIDIA Corp."             },
  { yahoo: "GOOGL", symbol: "GOOGL", name: "Alphabet Inc."            },
  { yahoo: "AMZN",  symbol: "AMZN",  name: "Amazon.com Inc."          },
  { yahoo: "TSLA",  symbol: "TSLA",  name: "Tesla Inc."               },
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

const FALLBACK_GOLD   = 4018;
const FALLBACK_SILVER = 58.5;
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
const cibRatesCache = makeCache<Record<string, number>>(5 * 60_000);

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

// ─── Metals market hours ──────────────────────────────────────────────────────
// Gold/silver CFDs trade continuously Sun 22:00 UTC – Fri 22:00 UTC (standard
// forex-hours approximation). Outside that window the market is closed, so
// "today's change" reads 0% instead of carrying over the last completed
// session's change — clearer than a frozen non-zero number over the weekend.

function isMetalsMarketOpen(now: Date): boolean {
  const day  = now.getUTCDay();  // 0=Sun, 5=Fri, 6=Sat
  const hour = now.getUTCHours();
  if (day === 6) return false;               // Saturday: always closed
  if (day === 0 && hour < 22) return false;   // Sunday before 22:00 UTC: not yet open
  if (day === 5 && hour >= 22) return false;  // Friday from 22:00 UTC: closed
  return true;
}

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

  const goldUsd   = metals?.xau ?? FALLBACK_GOLD;
  const silverUsd = metals?.xag ?? FALLBACK_SILVER;
  const metalsOpen = isMetalsMarketOpen(new Date());

  const price24k = round2((goldUsd * usdToEgp) / TROY_OZ);
  const goldEgpPerGram: Record<string, number> = {
    "24k": price24k,
    "22k": round2(price24k * (22 / 24)),
    "21k": round2(price24k * (21 / 24)),
    "18k": round2(price24k * (18 / 24)),
  };
  const silverEgpPerGram = round2((silverUsd * usdToEgp) / TROY_OZ);
  const usdToEgpDisplay  = Math.round(usdToEgp * 10000) / 10000;

  // Gold/silver's own previous close comes straight from TradingView on
  // every request — real, live, resets with TradingView's own session, no
  // fabrication and no dependency on this endpoint's own recorded history.
  // This is deliberately back to matching TradingView's own % change
  // directly, same reference point a user would see checking the metal
  // itself there.
  const goldChange    = metals && metalsOpen ? round2(goldUsd   - metals.xauPrevClose) : 0;
  const goldChangePct = metals && metalsOpen && metals.xauPrevClose > 0
    ? round2((goldChange / metals.xauPrevClose) * 100)
    : 0;

  const silverChange    = metals && metalsOpen ? round2(silverUsd - metals.xagPrevClose) : 0;
  const silverChangePct = metals && metalsOpen && metals.xagPrevClose > 0
    ? round2((silverChange / metals.xagPrevClose) * 100)
    : 0;

  // USD/EGP has no equivalent reliable "own previous close" the way
  // TradingView gives metals — Wise (the live-rate source) doesn't expose
  // one, and the free daily-snapshot APIs previously used to reconstruct it
  // turned out to be unreliably stale (see the removed fetchUsdToEgpPrevClose
  // — a response with no way to tell it was ~24h+ old). So this one alone is
  // anchored to this endpoint's own recorded history instead, and honestly
  // shows 0% until a real prior-day close exists.
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
  const { prevClose } = await recordAndGetPrevClose(cairoDateString(), {
    goldEgp24k: price24k, silverEgp: silverEgpPerGram, usdToEgp: usdToEgpDisplay,
  });

  const usdToEgpChangePercent = prevClose && prevClose.usdToEgp > 0
    ? round2(((usdToEgpDisplay - prevClose.usdToEgp) / prevClose.usdToEgp) * 100)
    : 0;

  // goldChangePercent/silverChangePercent above are deliberately raw-USD
  // (matching TradingView's own display, per explicit product decision) —
  // but a portfolio holding is valued in EGP, so applying that raw-USD %
  // straight to an EGP value silently drops the FX leg (the original
  // "gold shows +1.25% while the portfolio actually fell" bug, just
  // reachable again from this angle). These two fields compound the metal's
  // own USD move with today's USD/EGP move to give the metal's *real*
  // EGP-denominated change — this is what portfolio "today's gain" math
  // should read, never goldChangePercent/silverChangePercent directly.
  const goldChangePercentEgp = round2(
    ((1 + goldChangePct / 100) * (1 + usdToEgpChangePercent / 100) - 1) * 100
  );
  const silverChangePercentEgp = round2(
    ((1 + silverChangePct / 100) * (1 + usdToEgpChangePercent / 100) - 1) * 100
  );

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

// Columns returned per ticker: [close, change_abs, change%, volume, market_cap, 52w_high, 52w_low,
// P/E, div_yield, sector, EPS (TTM), revenue growth YoY (TTM), net margin (TTM), ROE (TTM),
// debt/equity (MRQ), price/book (FY)]
type TVRow = [
  number, number, number, number | null, number | null, number | null, number | null,
  number | null, number | null, string | null, number | null, number | null,
  number | null, number | null, number | null, number | null,
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
    ] = d;
    if (!close) continue;                              // skip if TV returned no price
    results.push({
      symbol,
      name:          EGX_NAMES[symbol] ?? name,
      price:         round2(close),
      previousClose: round2(close - changeAbs),
      change:        round2(changeAbs),
      changePercent: round2(changePct),
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
    });
  }
  return results;
}

// TradingView only. Yahoo Finance is removed by explicit product decision
// (2026-07-30) — the same policy already applied to FX (see fetchUsdToEgp):
// one trusted provider, no other source silently standing in for it. There
// is no fallback tier left; if TradingView's Egypt scanner fails, EGX prices
// come back empty rather than from a different, unvetted source.
export async function fetchStocks(): Promise<EGXStockResponse[]> {
  const tvData = await fetchEGXViaTradingView();
  logger.info({ count: tvData.length }, "EGX stocks via TradingView scanner");
  return tvData;
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
const EGX_INDICES = [
  { symbol: "EGX30", name: "EGX 30" },
  { symbol: "EGX70EWI", name: "EGX 70 EWI" },
] as const;

async function fetchEGXIndices(): Promise<EGXStockResponse[]> {
  const body = JSON.stringify({
    columns: ["close", "change_abs", "change", "volume"],
    symbols: { tickers: EGX_INDICES.map(i => `EGX:${i.symbol}`) },
  });
  const res = await safeFetch("https://scanner.tradingview.com/egypt/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "https://www.tradingview.com" },
    body,
  });
  const data = await safeJson<{ data: Array<{ s: string; d: [number, number, number, number | null] }> }>(
    res, "EGX indices TradingView"
  );
  if (!data?.data) return [];

  const bySymbol: Record<string, [number, number, number, number | null]> = {};
  for (const item of data.data) bySymbol[item.s.replace(/^EGX:/, "")] = item.d;

  const results: EGXStockResponse[] = [];
  for (const { symbol, name } of EGX_INDICES) {
    const d = bySymbol[symbol];
    if (!d) continue;
    const [close, changeAbs, changePct, volume] = d;
    if (!close) continue;
    results.push({
      symbol, name,
      price: round2(close), previousClose: round2(close - changeAbs),
      change: round2(changeAbs), changePercent: round2(changePct),
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

  const symbols = GLOBAL_TICKERS.map(t => t.yahoo).join(",");
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
    const q = isSingle ? data : data[t.yahoo];
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
      const sym = t.yahoo.toLowerCase() + ".us"; // e.g., AAPL → aapl.us
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

// ─── Gold history (sparkline) ─────────────────────────────────────────────────

const HISTORY_CFG: Record<string, { totalDays: number; count: number; ttlMs: number }> = {
  '1D':  { totalDays: 1,    count: 0,  ttlMs: 5  * 60_000 },  // special: derived from cache
  '1W':  { totalDays: 7,    count: 7,  ttlMs: 30 * 60_000 },
  '1M':  { totalDays: 30,   count: 10, ttlMs: 60 * 60_000 },
  '3M':  { totalDays: 90,   count: 12, ttlMs: 3  * 3600_000 },
  '1Y':  { totalDays: 365,  count: 12, ttlMs: 6  * 3600_000 },
  'ALL': { totalDays: 1825, count: 18, ttlMs: 24 * 3600_000 },
};

const histCaches: Record<string, ReturnType<typeof makeCache<number[]>>> = Object.fromEntries(
  Object.entries(HISTORY_CFG).map(([k, v]) => [k, makeCache<number[]>(v.ttlMs)])
);

/** Generate `count` evenly-spaced business-day dates going back `totalDays`. */
function sampledDates(totalDays: number, count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = count; i >= 1; i--) {
    const daysBack = Math.round((i / count) * totalDays);
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysBack);
    const dow = d.getUTCDay();
    if (dow === 0) d.setUTCDate(d.getUTCDate() - 2); // Sun → Fri
    if (dow === 6) d.setUTCDate(d.getUTCDate() - 1); // Sat → Fri
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

// Map our chart ranges to Twelve Data's interval/outputsize params for XAU/USD.
// Twelve Data, not Yahoo (2026-07-30) — the same provider already used for
// Global Stocks, reusing the same TWELVE_DATA_API_KEY rather than adding a
// new dependency for this one chart feature.
const TD_GOLD_RANGES: Record<string, { interval: string; outputsize: number }> = {
  '1W':  { interval: '1day',   outputsize: 7   },
  '1M':  { interval: '1day',   outputsize: 30  },
  '3M':  { interval: '1week',  outputsize: 13  },
  '1Y':  { interval: '1week',  outputsize: 52  },
  'ALL': { interval: '1month', outputsize: 60  },
};

async function fetchGoldClosesFromTwelveData(range: string): Promise<number[]> {
  const cfg = TD_GOLD_RANGES[range];
  if (!cfg) return [];
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) { logger.warn("TWELVE_DATA_API_KEY not set — gold history unavailable"); return []; }

  const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${cfg.interval}&outputsize=${cfg.outputsize}&apikey=${apiKey}`;
  const res = await safeFetch(url, { headers: { Accept: "application/json" } });
  if (!res?.ok) { logger.warn({ status: res?.status }, "Twelve Data gold history: non-OK response"); return []; }

  const data = await res.json() as { status?: string; code?: number; values?: Array<{ close: string }> };
  if (data?.status === "error" || data?.code) {
    logger.warn({ code: data?.code, message: (data as any)?.message }, "Twelve Data gold history: API error");
    return [];
  }

  // Twelve Data returns values most-recent-first; the chart wants chronological order.
  const closes = (data?.values ?? [])
    .map(v => parseFloat(v.close))
    .filter(c => !isNaN(c) && c > 0)
    .reverse();
  return closes;
}

async function buildGoldHistory(range: string): Promise<number[]> {
  const cached = histCaches[range]?.get();
  if (cached) return cached;

  if (range === '1D') {
    // Use TradingView metals data: [prevClose, currentClose]
    const metals = await fetchMetalsViaTradingView();
    const cachedPrices = pricesCache.get();
    const weekly = histCaches['1W']?.get();

    let pts: number[] | null = null;
    if (metals) {
      pts = [metals.xauPrevClose, metals.xau];
    } else {
      const yesterdayClose = weekly && weekly.length >= 2 ? weekly[weekly.length - 2] : null;
      const todayValue = cachedPrices?.goldUsd ?? null;
      if (yesterdayClose != null && todayValue != null) pts = [yesterdayClose, todayValue];
    }
    if (!pts) return [];
    histCaches['1D'].set(pts);
    return pts;
  }

  const cfg = HISTORY_CFG[range];
  if (!cfg) return [];

  const closes = await fetchGoldClosesFromTwelveData(range);
  const valid = closes;
  if (valid.length < 2) return [];

  histCaches[range].set(valid);
  return valid;
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

router.get("/markets/gold-history", async (req, res) => {
  const range = String(req.query.range ?? '1D');
  if (!HISTORY_CFG[range]) { res.status(400).json({ error: "Invalid range" }); return; }
  try {
    const points = await buildGoldHistory(range);
    res.json({ points, range });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch gold history");
    res.status(500).json({ error: "Failed to fetch gold history" });
  }
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

export default router;
