// Strips thousands-separator commas/spaces before parsing so "5,000,000" reads as
// 5000000 instead of parseFloat's default behavior of stopping at the first comma (5).
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[,\s]/g, ''));
}
