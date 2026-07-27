// Sharia (Islamic finance) compliance screening for EGX-listed stocks.
//
// Verdicts are derived in two layers, in order:
//  1. VERIFIED_COMPLIANT — tickers confirmed against real, citable sources:
//     the Egyptian Exchange's own EGX33 Shariah-Compliant Index constituent
//     list (egx.com.eg), cross-referenced against foudalens.com's EGX
//     Shariah screener and investing.com's index-components page. Every
//     entry here was matched by *ticker*, not fuzzy name-matching (an
//     earlier pass caught OCDI being mislabeled "Orascom Development Egypt"
//     instead of its real identity, SODIC — a reminder that name-only
//     matching between sources is unsafe for this).
//  2. Business-activity screening — categorical exclusions that don't
//     require financial statements at all: conventional (interest-based)
//     banks and insurers, and conventional financial-services companies
//     (investment banks, brokerages, leasing/factoring, consumer finance —
//     the AAOIFI/S&P Shariah standard's "conventional financial services"
//     sector exclusion). Islamic banks and tobacco are called out
//     explicitly since they're the same style of activity-based verdict.
//
// Everything else — the majority of the list — is genuinely UNSCREENED:
// real financial-ratio screening (debt/market-cap, cash+interest-bearing/
// market-cap, receivables/market-cap, non-permissible income %) needs each
// company's balance sheet, which isn't available from the price feeds this
// app uses. Rather than guess, those get an honest "not officially
// screened" status instead of a fabricated verdict.
//
// Last verified: 2026-07-27.

import { EGX_COMPANIES } from './egx-companies';

export type ShariaVerdict = 'compliant' | 'non_compliant' | 'unscreened';

export interface ShariaCompliance {
  ticker: string;
  verdict: ShariaVerdict;
  reason: string;
  guidance: string;
  source?: string;
}

const SOURCE_EGX33 = "EGX33 Shariah-Compliant Index (egx.com.eg), cross-checked against foudalens.com and investing.com";

// Tickers verified (by ticker, not name) as constituents of the official
// EGX33 Shariah-Compliant Index. Islamic banks are handled separately below
// via their `industry` tag rather than listed here.
// CLHO (Cleopatra Hospital) was a constituent in the foudalens/investing.com
// snapshots this list was originally built from, but the official EGX
// semi-annual rebalance (effective 2026-02-01) removed it from EGX33
// Shariah — no reason was published, so it's left unscreened rather than
// marked non-compliant on a guess. CIRA was added in that same rebalance
// and is included below.
const VERIFIED_COMPLIANT = new Set([
  'TMGH', 'PHDC', 'MASR', 'OCDI', 'ORHD', 'ORWE', 'MTIE', 'ORAS', 'ATQA',
  'MCQE', 'EGAL', 'ABUK', 'SKPC', 'MFPC', 'AMOC', 'EGAS', 'ARCC', 'LCSW',
  'ISPH', 'RMDA', 'JUFO', 'EFID', 'OLFI', 'IFAP', 'EFIH', 'RACC',
  'FWRY', 'ACGC', 'CIRA', 'ETRS', 'ETEL', 'MPCO', 'ICFC',
]);

// Tickers whose sector/industry tag in egx-companies.ts doesn't match their
// real underlying business closely enough to trust the categorical rules
// below (e.g. tagged "Financial Services" but the actual company is an
// engineering consultancy) — left unscreened rather than guessed either way.
const SECTOR_TAG_UNRELIABLE = new Set(['DAPH']);

const PURIFICATION_NOTE =
  "Even compliant stocks can carry a small amount of incidental non-permissible income (e.g. bank interest on idle cash), generally accepted up to about 5% of revenue. The common guidance is to purify by donating that same percentage of your dividends to charity — check the company's own disclosures for its exact ratio where available.";

const AVOID_GUIDANCE =
  "This fails Sharia screening by business activity, not by a borderline ratio — mainstream guidance is to avoid new positions. If you already hold shares, guidance is to divest and purify any dividends already received by donating them in full to charity.";

const UNSCREENED_GUIDANCE =
  "Not part of the official EGX Shariah-compliant index and not one of the categorical exclusions (conventional banking/insurance/financial services). A real verdict needs the company's debt, cash, and receivables ratios plus its revenue breakdown — data this app doesn't have. Verify independently (e.g. with a dedicated Islamic-screening service) before investing for religious purposes.";

function classify(ticker: string, sector: string, industry: string): ShariaCompliance {
  if (industry === 'Islamic Banking') {
    return {
      ticker, verdict: 'compliant',
      reason: 'Islamic bank — operates on profit-sharing/Murabaha principles, not interest.',
      guidance: PURIFICATION_NOTE,
      source: SOURCE_EGX33,
    };
  }

  if (VERIFIED_COMPLIANT.has(ticker)) {
    return {
      ticker, verdict: 'compliant',
      reason: 'Constituent of the official EGX33 Shariah-Compliant Index.',
      guidance: PURIFICATION_NOTE,
      source: SOURCE_EGX33,
    };
  }

  if (SECTOR_TAG_UNRELIABLE.has(ticker)) {
    return {
      ticker, verdict: 'unscreened',
      reason: "Not on the official compliant index, and this company's business doesn't clearly match its listed sector — not confident enough to categorize either way.",
      guidance: UNSCREENED_GUIDANCE,
    };
  }

  if (industry === 'Banks') {
    return {
      ticker, verdict: 'non_compliant',
      reason: 'Conventional interest-based bank.',
      guidance: AVOID_GUIDANCE,
    };
  }

  if (sector === 'Insurance') {
    return {
      ticker, verdict: 'non_compliant',
      reason: 'Conventional insurance — involves interest-based reserve investment and excessive uncertainty (gharar), both excluded under mainstream Islamic finance guidance.',
      guidance: AVOID_GUIDANCE,
    };
  }

  if (industry === 'Tobacco') {
    return {
      ticker, verdict: 'non_compliant',
      reason: 'Tobacco/cigarette manufacturing — a health-harming product excluded under mainstream Islamic guidance.',
      guidance: AVOID_GUIDANCE,
    };
  }

  if (sector === 'Financial Services') {
    return {
      ticker, verdict: 'non_compliant',
      reason: 'Conventional financial-services company (investment banking, brokerage, leasing, factoring, or consumer finance) — these earn their core revenue from interest-based lending or fees on interest-based products, excluded by business activity regardless of financial ratios.',
      guidance: AVOID_GUIDANCE,
    };
  }

  return {
    ticker, verdict: 'unscreened',
    reason: 'Not part of the official EGX Shariah-compliant index, and not a conventional bank/insurer/financial-services company.',
    guidance: UNSCREENED_GUIDANCE,
  };
}

export const EGX_SHARIA_COMPLIANCE: Record<string, ShariaCompliance> = Object.fromEntries(
  EGX_COMPANIES.map(c => [c.ticker, classify(c.ticker, c.sector, c.industry)])
);

export function getShariaCompliance(ticker: string): ShariaCompliance | null {
  return EGX_SHARIA_COMPLIANCE[ticker.toUpperCase()] ?? null;
}
