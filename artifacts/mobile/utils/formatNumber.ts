// Shared compact number format — e.g. "50.8K", "3.47M" — used anywhere a
// monetary delta or total needs the same abbreviated style (Overview's
// Today/Total P/L, Cash Accounts' today-change badge, etc.). Keeping this
// in one place is what keeps those displays consistent with each other.
// toFixed pads to a fixed width, so a round value picks up decimals that
// carry no information — 10,000 rendered as "10.0K", 1,200,000 as "1.20M".
// Next to the genuinely-precise figures these sit beside ("3.48M", "497K"),
// that trailing zero reads as significance it doesn't have. Only strip
// zeros that are pure padding: "3.48" and "1.2" keep every digit that says
// something.
function trimTrailingZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

// Two decimals throughout, matching the convention these figures are read
// against elsewhere (102,188 -> "102.19k", 244,439 -> "244.44k"): that is
// 10 EGP of resolution, so a compact balance stays close enough to the real
// one to be trusted rather than merely indicative. One decimal was tried
// first and rounded 327,280 to "327.3k", still discarding 20 EGP for no
// benefit — the string is the same width either way.
//
// Lowercase k, uppercase M, per that same convention and per SI (kilo is
// lowercase, mega is uppercase).
//
// Detail screens deliberately do NOT use this — Cash Accounts' "Total Cash",
// the balance-update history, and the edit form all print the exact figure.
// Compact is for scannable rows; anywhere the number is the point, it stays
// whole.
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${trimTrailingZeros((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000)     return `${trimTrailingZeros((n / 1_000).toFixed(2))}k`;
  return n.toLocaleString('en-EG', { maximumFractionDigits: 0 });
}
