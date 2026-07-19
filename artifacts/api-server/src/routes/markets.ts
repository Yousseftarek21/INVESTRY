import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketPricesResponse {
  goldUsd: number;
  silverUsd: number;
  usdToEgp: number;
  goldChange: number;
  goldChangePercent: number;
  silverChange: number;
  silverChangePercent: number;
  goldEgpPerGram: Record<string, number>;
  silverEgpPerGram: number;
  fxRates: Record<string, number>;
  lastUpdated: string;
  sources: string[];
}

interface EGXStockResponse {
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
  { yahoo: "ARVA.CA",   symbol: "ARVA",   name: "Arab Valves"                                  },
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

// Yahoo Finance spark endpoint
const YF_SPARK_BASE = "https://query1.finance.yahoo.com/v7/finance/spark";

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Yahoo Finance Session (crumb + cookie) ────────────────────────────────────
// Yahoo Finance rate-limits unauthenticated API calls from shared IPs.
// Establishing a session cookie (from fc.yahoo.com) + crumb bypasses this.

interface YFSession { crumb: string; cookie: string; expiresAt: number }
let _yfSession: YFSession | null = null;

async function getYFSession(): Promise<YFSession | null> {
  if (_yfSession && Date.now() < _yfSession.expiresAt) return _yfSession;

  try {
    // Step 1 — fc.yahoo.com issues the A3 session cookie via a redirect response.
    // Use redirect:'manual' so we can read Set-Cookie before it's consumed.
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    const fcRes = await fetch("https://fc.yahoo.com/", {
      redirect: "manual",
      headers: {
        "User-Agent": BASE_HEADERS["User-Agent"],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: ctrl1.signal,
    });
    clearTimeout(t1);

    // Collect Set-Cookie headers (Node 18+ Headers.getSetCookie() returns string[])
    const rawCookies: string[] =
      typeof (fcRes.headers as any).getSetCookie === "function"
        ? (fcRes.headers as any).getSetCookie()
        : [(fcRes.headers.get("set-cookie") ?? "")];

    let cookie = "";
    for (const rc of rawCookies) {
      const m = rc.match(/\b(A3=[^;]+)/);
      if (m) { cookie = m[1]; break; }
    }
    if (!cookie) {
      for (const rc of rawCookies) {
        const m = rc.match(/\b(A1=[^;]+)/);
        if (m) { cookie = m[1]; break; }
      }
    }
    if (!cookie) {
      logger.warn("YF session: no A3/A1 cookie from fc.yahoo.com");
      return null;
    }

    // Step 2 — exchange cookie for a crumb
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), 8000);
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...BASE_HEADERS, Cookie: cookie },
      signal: ctrl2.signal,
    });
    clearTimeout(t2);

    if (!crumbRes.ok) {
      logger.warn({ status: crumbRes.status }, "YF session: getcrumb failed");
      return null;
    }
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 30 || crumb.includes("<")) {
      logger.warn("YF session: invalid crumb received");
      return null;
    }

    _yfSession = { crumb, cookie, expiresAt: Date.now() + 20 * 60_000 }; // 20 min TTL
    logger.info({ crumbLen: crumb.length }, "YF session established");
    return _yfSession;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "YF session: setup failed");
    return null;
  }
}

/** Build authenticated YF headers (with cookie + crumb appended to URL). */
function yfAuthHeaders(session: YFSession | null): Record<string, string> {
  const h: Record<string, string> = { ...BASE_HEADERS };
  if (session?.cookie) h["Cookie"] = session.cookie;
  return h;
}
function yfCrumbParam(session: YFSession | null): string {
  return session ? `&crumb=${encodeURIComponent(session.crumb)}` : "";
}

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

function yesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}


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
// CommodityPriceAPI has no FX pairs, so we fetch the mid-market rate from:
//   1. Wise   — real-time mid-market (same as XE / Google Finance)
//   2. fawazahmed0 (jsdelivr CDN)  — daily, no key
//   3. fawazahmed0 (CF pages CDN)  — daily, no key (alternate CDN)
//   4. open.er-api.com             — daily, no key (last resort)
//   5. hardcoded fallback

interface WiseRateResponse { source: string; target: string; value: number; time: number }
interface Fawaz0Response { date: string; usd: { egp: number } }
interface ErApiResponse  { rates: { EGP: number } }

async function fetchUsdToEgp(): Promise<number> {
  // 1. Wise real-time mid-market rate (updates every few seconds)
  const wise = await safeJson<WiseRateResponse>(
    await safeFetch("https://wise.com/rates/live?source=USD&target=EGP")
  );
  if (wise?.value && wise.value > 0) {
    logger.info({ rate: wise.value, ts: wise.time }, "USD/EGP from Wise");
    return wise.value;
  }

  // 2. fawazahmed0 via jsDelivr CDN (daily, highly accurate)
  const fawaz1 = await safeJson<Fawaz0Response>(
    await safeFetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json")
  );
  if (fawaz1?.usd?.egp && fawaz1.usd.egp > 0) return fawaz1.usd.egp;

  // 3. fawazahmed0 via Cloudflare Pages CDN (alternate)
  const fawaz2 = await safeJson<Fawaz0Response>(
    await safeFetch("https://latest.currency-api.pages.dev/v1/currencies/usd.json")
  );
  if (fawaz2?.usd?.egp && fawaz2.usd.egp > 0) return fawaz2.usd.egp;

  // 4. open.er-api.com (daily)
  const er = await safeJson<ErApiResponse>(
    await safeFetch("https://open.er-api.com/v6/latest/USD")
  );
  if (er?.rates?.EGP && er.rates.EGP > 0) return er.rates.EGP;

  return FALLBACK_EGP;
}

// ─── FX cross rates via Wise (same source as USD/EGP) ────────────────────────
// Primary: Wise live mid-market rates for each currency pair directly vs EGP.
// Fallback: open.er-api.com cross-rates for any pair Wise doesn't return.

const FX_SYMBOLS = ['EUR', 'GBP', 'TRY', 'CNY', 'CHF', 'QAR', 'SAR', 'AED', 'KWD'] as const;

interface ErApiFullResponse { rates: Record<string, number> }

async function fetchFxCrossRates(usdToEgp: number): Promise<Record<string, number>> {
  // Fetch all pairs from Wise in parallel — same endpoint used for USD/EGP
  const settled = await Promise.allSettled(
    FX_SYMBOLS.map(async sym => {
      const data = await safeJson<WiseRateResponse>(
        await safeFetch(`https://wise.com/rates/live?source=${sym}&target=EGP`)
      );
      return { sym, value: data?.value ?? null };
    })
  );

  const out: Record<string, number> = {};
  const missing: string[] = [];

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.value && r.value.value > 0) {
      out[r.value.sym] = Math.round(r.value.value * 10000) / 10000;
      logger.info({ sym: r.value.sym, rate: r.value.value }, `FX from Wise`);
    } else {
      if (r.status === 'fulfilled') missing.push(r.value.sym);
    }
  }

  // Fallback to open.er-api.com for any pair Wise didn't return
  if (missing.length > 0) {
    logger.warn({ missing }, "FX Wise fallback to open.er-api.com for some pairs");
    const er = await safeJson<ErApiFullResponse>(
      await safeFetch("https://open.er-api.com/v6/latest/USD")
    );
    const raw = er?.rates ?? {};
    for (const sym of missing) {
      const r = raw[sym];
      if (r && r > 0) out[sym] = Math.round((usdToEgp / r) * 10000) / 10000;
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

// ─── Assemble prices ──────────────────────────────────────────────────────────

export async function fetchPrices(): Promise<MarketPricesResponse> {
  // All three run in parallel — TradingView scanner is ~100-200 ms, no key needed.
  // fetchFxCrossRates uses FALLBACK_EGP only for its ER-API cross-rate fallback;
  // Wise fetches each pair directly so it doesn't need usdToEgp at fetch time.
  const [metals, usdToEgp, fxRates] = await Promise.all([
    fetchMetalsViaTradingView(),
    fetchUsdToEgp(),
    fetchFxCrossRates(FALLBACK_EGP),
  ]);

  const goldUsd   = metals?.xau ?? FALLBACK_GOLD;
  const silverUsd = metals?.xag ?? FALLBACK_SILVER;
  const metalsOpen = isMetalsMarketOpen(new Date());

  const goldChange    = metals && metalsOpen ? round2(goldUsd   - metals.xauPrevClose) : 0;
  const goldChangePct = metals && metalsOpen && metals.xauPrevClose > 0
    ? round2((goldChange / metals.xauPrevClose) * 100) : 0;

  const silverChange    = metals && metalsOpen ? round2(silverUsd - metals.xagPrevClose) : 0;
  const silverChangePct = metals && metalsOpen && metals.xagPrevClose > 0
    ? round2((silverChange / metals.xagPrevClose) * 100) : 0;

  const price24k = round2((goldUsd * usdToEgp) / TROY_OZ);
  const goldEgpPerGram: Record<string, number> = {
    "24k": price24k,
    "22k": round2(price24k * (22 / 24)),
    "21k": round2(price24k * (21 / 24)),
    "18k": round2(price24k * (18 / 24)),
  };
  const silverEgpPerGram = round2((silverUsd * usdToEgp) / TROY_OZ);
  const usdToEgpDisplay  = Math.round(usdToEgp * 10000) / 10000;

  return {
    goldUsd:             round2(goldUsd),
    silverUsd:           round2(silverUsd),
    usdToEgp:            usdToEgpDisplay,
    goldChange,
    goldChangePercent:   goldChangePct,
    silverChange,
    silverChangePercent: silverChangePct,
    goldEgpPerGram,
    silverEgpPerGram,
    fxRates,
    lastUpdated: new Date().toISOString(),
    sources:     metals ? ["tradingview-cfd"] : ["fallback"],
  };
}

// ─── EGX Stocks via Yahoo Finance Spark endpoint ──────────────────────────────

interface SparkMeta {
  currency: string;
  symbol: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}

interface SparkResponse {
  spark: {
    result: Array<{
      symbol: string;
      response: Array<{
        meta: SparkMeta;
        indicators: {
          quote: Array<{ close: (number | null)[] }>;
        };
      }>;
    }> | null;
  };
}

/** Fetch live quotes for a list of Yahoo tickers via the free spark endpoint, in batches of 10. */
async function fetchTickersViaSpark(
  tickers: { yahoo: string; symbol: string; name: string }[],
  logLabel: string
): Promise<EGXStockResponse[]> {
  const session = await getYFSession();
  const batches: { yahoo: string; symbol: string; name: string }[][] = [];
  for (let i = 0; i < tickers.length; i += 10) batches.push(tickers.slice(i, i + 10));

  const responses = await Promise.all(
    batches.map(async batch =>
      safeJson<SparkResponse>(
        await safeFetch(
          `${YF_SPARK_BASE}?symbols=${encodeURIComponent(batch.map(t => t.yahoo).join(","))}&range=5d&interval=1d${yfCrumbParam(session)}`,
          { headers: yfAuthHeaders(session) }
        )
      )
    )
  );

  const allResults = responses.flatMap(r => r?.spark?.result ?? []);

  if (allResults.length === 0) {
    logger.warn(`${logLabel}: Yahoo Finance spark returned no data`);
    return [];
  }

  const byTicker = new Map(allResults.map(r => [r.symbol, r]));

  return tickers.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const resp = r.response?.[0];
    if (!resp) return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };

    const meta = resp.meta;
    const closes = (resp.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => c !== null && c > 0);

    const price = round2(meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0);
    const prevClose = round2(
      meta.previousClose ?? meta.chartPreviousClose ?? closes[closes.length - 2] ?? 0
    );

    const change = prevClose > 0 ? round2(price - prevClose) : 0;
    const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

    return { symbol: t.symbol, name: t.name, price, previousClose: prevClose, change, changePercent };
  });
}

// ─── EGX via TradingView Egypt scanner ────────────────────────────────────────
// No filter — fetches ALL 292 EGX stocks in one request.
// columns: [close, change_abs, change%, volume]

// Build lookup maps from our authoritative EGX ticker list
const EGX_NAMES: Record<string, string>  = Object.fromEntries(EGX_TICKERS.map(t => [t.symbol, t.name]));
const EGX_SYMBOL_SET: Set<string>        = new Set(EGX_TICKERS.map(t => t.symbol));

// Batch size kept at 150 — TradingView accepts it in one call with no rate issues.
const TV_BATCH_SIZE = 150;

// Columns returned per ticker: [close, change_abs, change%, volume, market_cap, 52w_high, 52w_low, P/E, div_yield]
type TVRow = [number, number, number, number | null, number | null, number | null, number | null, number | null, number | null];

async function fetchEGXViaTradingView(): Promise<EGXStockResponse[]> {
  const allSymbols = EGX_TICKERS.map(t => t.symbol);
  const priceMap: Record<string, TVRow> = {};

  // Split into batches and query each with explicit symbol list so TradingView
  // returns prices for every ticker, not just its own "top active" subset.
  for (let i = 0; i < allSymbols.length; i += TV_BATCH_SIZE) {
    const batch = allSymbols.slice(i, i + TV_BATCH_SIZE);
    const body = JSON.stringify({
      columns: ["close", "change_abs", "change", "volume", "market_cap_basic", "52_week_high", "52_week_low", "P.E", "dividends_yield_current"],
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
    const [close, changeAbs, changePct, volume, marketCap, high52w, low52w, pe, divYield] = d;
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
    });
  }
  return results;
}

async function fetchStocks(): Promise<EGXStockResponse[]> {
  // 1. TradingView Egypt scanner — single request, correct prices, works from server
  try {
    const tvData = await fetchEGXViaTradingView();
    if (tvData.some(s => s.price > 0)) {
      logger.info({ count: tvData.length }, "EGX stocks via TradingView scanner");
      return tvData;
    }
  } catch (err) {
    logger.warn({ err }, "EGX: TradingView scanner failed");
  }

  // 2. YF spark fallback (all tickers)
  return fetchTickersViaSpark(EGX_TICKERS, "EGX stocks");
}

/** Fetch US stock quotes via Yahoo Finance v7/finance/quote (authenticated with crumb+cookie). */
async function fetchGlobalStocksViaQuote(): Promise<EGXStockResponse[]> {
  const session = await getYFSession();
  const symbols = GLOBAL_TICKERS.map(t => t.yahoo).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en-US&region=US${yfCrumbParam(session)}`;
  const res = await safeFetch(url, { headers: yfAuthHeaders(session) });
  const data = await safeJson<{ quoteResponse: { result: any[] } }>(res, "Global stocks quote");
  const results: any[] = data?.quoteResponse?.result ?? [];
  if (results.length === 0) {
    logger.warn("Global stocks: Yahoo Finance quote returned no data");
    return [];
  }
  const byTicker = new Map<string, any>(results.map((r: any) => [r.symbol as string, r]));
  return GLOBAL_TICKERS.map(t => {
    const r = byTicker.get(t.yahoo);
    if (!r?.regularMarketPrice) {
      return { symbol: t.symbol, name: t.name, price: 0, previousClose: 0, change: 0, changePercent: 0 };
    }
    return {
      symbol: t.symbol, name: t.name,
      price:         round2(r.regularMarketPrice),
      previousClose: round2(r.regularMarketPreviousClose ?? 0),
      change:        round2(r.regularMarketChange ?? 0),
      changePercent: round2(r.regularMarketChangePercent ?? 0),
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

  // 2. YF quote with crumb/cookie
  try {
    const data = await fetchGlobalStocksViaQuote();
    if (data.some(s => s.price > 0)) {
      logger.info("Global stocks via YF quote");
      return data;
    }
  } catch { /* fall through */ }

  // 3. YF spark
  try {
    const data = await fetchTickersViaSpark(GLOBAL_TICKERS, "Global stocks spark");
    if (data.some(s => s.price > 0)) return data;
  } catch { /* fall through */ }

  // 4. Stooq — independent provider, not IP-blocked by YF
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

// Map our chart ranges to Yahoo Finance range/interval params for GC=F (Gold Futures)
const YF_GOLD_RANGES: Record<string, { yfRange: string; yfInterval: string }> = {
  '1W':  { yfRange: '5d',  yfInterval: '1d'  },
  '1M':  { yfRange: '1mo', yfInterval: '1d'  },
  '3M':  { yfRange: '3mo', yfInterval: '1wk' },
  '1Y':  { yfRange: '1y',  yfInterval: '1wk' },
  'ALL': { yfRange: '5y',  yfInterval: '1mo' },
};

async function fetchGoldClosesFromYF(range: string): Promise<number[]> {
  const yf = YF_GOLD_RANGES[range];
  if (!yf) return [];
  const session = await getYFSession();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=${yf.yfRange}&interval=${yf.yfInterval}`;
  const res = await safeFetch(url, { headers: yfAuthHeaders(session) });
  if (!res?.ok) return [];
  const data = await res.json() as { chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((c): c is number => c !== null && c > 0);
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

  const closes = await fetchGoldClosesFromYF(range);
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
