// Shariah screening reference data, served rather than compiled into the app.
//
// The EGX33 Shariah-Compliant Index is rebalanced semi-annually by the
// Egyptian Exchange's own Shariah board. While this list lived in the mobile
// bundle, every rebalance needed a release to correct — so the app shipped a
// list that was known to go stale twice a year. Serving it means a correction
// is a redeploy, and every user has it on their next refresh.
//
// It stays a hand-maintained constant rather than a scrape: egx.com.eg is
// unreachable from this server (connection times out — it appears to block
// datacenter IPs), and EGX:EGX33 does not resolve on TradingView's scanner
// either. Both were tried. Inventing a source would be worse than an honest
// hand-updated list with a visible date on it.
//
// ── AAOIFI's four screens, and which of them this app can actually apply ──
//   1. Business activity is halal      — applied, from sector/industry.
//   2. Debt / market cap under ~33%    — applied, computed live: TradingView
//                                        exposes total_debt and
//                                        market_cap_basic for EGX tickers.
//   3. Cash + interest-bearing         — NOT applied. No source. Probed nine
//      securities / market cap           column names on TradingView's Egypt
//                                        scanner (cash_n_short_term_invest,
//                                        cash_and_equivalents, total_cash,
//                                        short_term_investments, …); every
//                                        one returns null for every ticker.
//   4. Non-permissible income under 5% — NOT applied. Needs a revenue
//                                        breakdown no available feed carries.
//
// So a stock passing the checks here is NOT thereby AAOIFI-compliant: two of
// the four screens are simply unavailable. Only EGX33 membership represents a
// full screen, because EGX's own board applies all four. Everything else is
// reported as partially screened, and the app must say so.

/** Debt ÷ market cap ceiling. AAOIFI is stated as 30%, S&P/Dow Jones as 33%;
 *  30% is the stricter reading and the one applied here. */
export const DEBT_TO_MARKET_CAP_MAX = 0.30;

// Constituents of the official EGX33 Shariah-Compliant Index, matched by
// ticker rather than name — an earlier pass had OCDI labelled "Orascom
// Development Egypt" when it is in fact SODIC, which is why name matching is
// not used here.
//
// CLHO (Cleopatra Hospital) was a constituent in an earlier snapshot but was
// removed at the rebalance effective 2026-02-01; no reason was published, so
// it is left unscreened rather than marked non-compliant on a guess. CIRA was
// added at that same rebalance.
export const EGX33_SHARIAH = [
  'TMGH', 'PHDC', 'MASR', 'OCDI', 'ORHD', 'ORWE', 'MTIE', 'ORAS', 'ATQA',
  'MCQE', 'EGAL', 'ABUK', 'SKPC', 'MFPC', 'AMOC', 'EGAS', 'ARCC', 'LCSW',
  'ISPH', 'RMDA', 'JUFO', 'EFID', 'OLFI', 'IFAP', 'EFIH', 'RACC',
  'FWRY', 'ACGC', 'CIRA', 'ETRS', 'ETEL', 'MPCO', 'ICFC',
];

// Tickers whose sector/industry tag doesn't match their real business closely
// enough to trust the categorical rules (e.g. tagged "Financial Services"
// while actually an engineering consultancy). Left unscreened rather than
// guessed either way.
export const SECTOR_TAG_UNRELIABLE = ['DAPH'];

/** Date the list above was last checked against EGX's published index. */
export const LIST_VERIFIED_ON = '2026-07-27';

export interface ShariahScreeningReference {
  egx33Shariah: string[];
  sectorTagUnreliable: string[];
  debtToMarketCapMax: number;
  listVerifiedOn: string;
  /** Which AAOIFI screens this data supports, so the app states its own
   *  limits from the server rather than hardcoding that claim too. */
  screensApplied: { activity: boolean; debt: boolean; liquidity: boolean; income: boolean };
}

export function shariahScreeningReference(): ShariahScreeningReference {
  return {
    egx33Shariah: EGX33_SHARIAH,
    sectorTagUnreliable: SECTOR_TAG_UNRELIABLE,
    debtToMarketCapMax: DEBT_TO_MARKET_CAP_MAX,
    listVerifiedOn: LIST_VERIFIED_ON,
    screensApplied: { activity: true, debt: true, liquidity: false, income: false },
  };
}
