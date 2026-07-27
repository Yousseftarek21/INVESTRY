// Shariah (Islamic finance) compliance screening for EGX-listed stocks.
//
// Verdicts are derived in two layers, in order:
//  1. VERIFIED_COMPLIANT — tickers confirmed as constituents of the Egyptian
//     Exchange's own official EGX33 Shariah-Compliant Index (egx.com.eg),
//     matched by *ticker*, not fuzzy name-matching (an earlier pass caught
//     OCDI being mislabeled "Orascom Development Egypt" instead of its real
//     identity, SODIC — a reminder that name-only matching is unsafe here).
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
// This file only decides *which* reason/guidance applies (as translation
// keys) — the actual displayed sentences live in i18n/index.ts alongside
// every other piece of user-facing text in the app, so Arabic gets the
// same real translations as English instead of falling back to English
// prose baked into this data file.
//
// Last verified: 2026-07-27.

import { EGX_COMPANIES } from './egx-companies';

export type ShariaVerdict = 'compliant' | 'non_compliant' | 'unscreened';

export type ShariaReasonKey =
  | 'islamicBank' | 'egx33' | 'unreliableTag'
  | 'bank' | 'insurance' | 'tobacco' | 'financial' | 'genericUnscreened';

export type ShariaGuidanceKey = 'purification' | 'avoid' | 'unscreened';

export interface ShariaCompliance {
  ticker: string;
  verdict: ShariaVerdict;
  reasonKey: ShariaReasonKey;
  guidanceKey: ShariaGuidanceKey;
  hasSource: boolean;
}

// Tickers verified (by ticker, not name) as constituents of the official
// EGX33 Shariah-Compliant Index. Islamic banks are handled separately below
// via their `industry` tag rather than listed here.
// CLHO (Cleopatra Hospital) was a constituent in this list's earlier
// snapshot, but the official EGX semi-annual rebalance (effective
// 2026-02-01) removed it from EGX33 Shariah — no reason was published, so
// it's left unscreened rather than marked non-compliant on a guess. CIRA
// was added in that same rebalance and is included below.
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

function classify(ticker: string, sector: string, industry: string): ShariaCompliance {
  if (industry === 'Islamic Banking') {
    return { ticker, verdict: 'compliant', reasonKey: 'islamicBank', guidanceKey: 'purification', hasSource: true };
  }

  if (VERIFIED_COMPLIANT.has(ticker)) {
    return { ticker, verdict: 'compliant', reasonKey: 'egx33', guidanceKey: 'purification', hasSource: true };
  }

  if (SECTOR_TAG_UNRELIABLE.has(ticker)) {
    return { ticker, verdict: 'unscreened', reasonKey: 'unreliableTag', guidanceKey: 'unscreened', hasSource: false };
  }

  if (industry === 'Banks') {
    return { ticker, verdict: 'non_compliant', reasonKey: 'bank', guidanceKey: 'avoid', hasSource: false };
  }

  if (sector === 'Insurance') {
    return { ticker, verdict: 'non_compliant', reasonKey: 'insurance', guidanceKey: 'avoid', hasSource: false };
  }

  if (industry === 'Tobacco') {
    return { ticker, verdict: 'non_compliant', reasonKey: 'tobacco', guidanceKey: 'avoid', hasSource: false };
  }

  if (sector === 'Financial Services') {
    return { ticker, verdict: 'non_compliant', reasonKey: 'financial', guidanceKey: 'avoid', hasSource: false };
  }

  return { ticker, verdict: 'unscreened', reasonKey: 'genericUnscreened', guidanceKey: 'unscreened', hasSource: false };
}

export const EGX_SHARIA_COMPLIANCE: Record<string, ShariaCompliance> = Object.fromEntries(
  EGX_COMPANIES.map(c => [c.ticker, classify(c.ticker, c.sector, c.industry)])
);

export function getShariaCompliance(ticker: string): ShariaCompliance | null {
  return EGX_SHARIA_COMPLIANCE[ticker.toUpperCase()] ?? null;
}
