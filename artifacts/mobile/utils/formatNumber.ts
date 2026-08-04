// Shared compact number format — e.g. "50.8K", "3.47M" — used anywhere a
// monetary delta or total needs the same abbreviated style (Overview's
// Today/Total P/L, Cash Accounts' today-change badge, etc.). Keeping this
// in one place is what keeps those displays consistent with each other.
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}
