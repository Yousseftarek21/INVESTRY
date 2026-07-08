// Strips thousands-separator commas/spaces before parsing so "5,000,000" reads as
// 5000000 instead of parseFloat's default behavior of stopping at the first comma (5).
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[,\s]/g, ''));
}

// Live-formats a numeric TextInput value with thousands-separator commas as the user
// types (e.g. "5000000" -> "5,000,000"). Many devices' decimal-pad keyboard has no comma
// key, so this lets users type plain digits while still seeing/using comma grouping.
// Keeps at most one decimal point and up to 2 decimal digits, and tolerates a trailing
// "." while the user is still typing (e.g. "5,000.").
export function formatAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const intPartRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPartRaw = firstDot === -1 ? '' : cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (firstDot === -1) return withCommas;
  return `${withCommas}.${decPartRaw}`;
}
