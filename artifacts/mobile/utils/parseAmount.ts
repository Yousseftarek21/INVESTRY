// Arabic keyboards commonly type Arabic-Indic (٠-٩) or Extended Arabic-Indic/
// Persian (۰-۹) digits instead of Western ones, and an Arabic decimal
// separator (٫) instead of a dot — any regex filtering for plain "0-9" or "."
// would silently strip every character the user types on such a keyboard,
// making the field appear to reject all input. Normalizing to Western digits
// first fixes that at the source instead of in each individual input handler.
export function toWesternDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٫٬]/g, '.');
}

// Strips thousands-separator commas/spaces before parsing so "5,000,000" reads as
// 5000000 instead of parseFloat's default behavior of stopping at the first comma (5).
export function parseAmount(value: string): number {
  return parseFloat(toWesternDigits(value).replace(/[,\s]/g, ''));
}

// Cleans a numeric TextInput value with no comma grouping — strips anything that
// isn't a digit or dot, keeps at most one decimal point, up to 2 decimal digits,
// and no leading zeros. Use this (not formatAmountInput) as the onChangeText
// handler for any input the user is actively typing into — see AmountInput.tsx
// for why comma-formatting a focused, controlled input is a real bug, not a
// style choice.
export function cleanAmountInput(value: string): string {
  const cleaned = toWesternDigits(value).replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const intPartRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPartRaw = firstDot === -1 ? '' : cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  if (firstDot === -1) return intPart;
  return `${intPart}.${decPartRaw}`;
}

// Formats a clean amount string with thousands-separator commas for *display*
// (e.g. "5000000" -> "5,000,000"). Only safe to feed into a focused TextInput's
// value if you also solve cursor placement (see AmountInput.tsx) — for plain
// display (list rows, read-only previews) it's fine to use directly.
export function formatAmountInput(value: string): string {
  const clean = cleanAmountInput(value);
  const firstDot = clean.indexOf('.');
  const intPart = firstDot === -1 ? clean : clean.slice(0, firstDot);
  const decPart = firstDot === -1 ? '' : clean.slice(firstDot + 1);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (firstDot === -1) return withCommas;
  return `${withCommas}.${decPart}`;
}
