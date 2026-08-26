// Converts "today's value + today's % change" into the EGP delta since
// yesterday's close, exactly — not the v * pct shortcut, which silently
// applies the percentage to *today's* value instead of yesterday's and
// under/overstates the delta by a growing margin as the move gets bigger
// (confirmed: a real -1.47% day was showing as -1.45%, a ~0.02pp error that
// scales with the size of the move, not a rounding artifact).
//
// Derivation: if f is the fractional change (pctChange / 100), then
// todaysValue = startValue * (1 + f), so startValue = todaysValue / (1 + f)
// and delta = todaysValue - startValue = todaysValue * f / (1 + f).
export function pctDelta(todaysValue: number, pctChange: number): number {
  const f = pctChange / 100;
  if (f <= -1) return -todaysValue; // guard: a >=100% loss has no valid start value to divide by
  return (todaysValue * f) / (1 + f);
}

// The Today's Change contribution (EGP) for a gold/silver/stock lot that
// was added or edited TODAY — real movement since the server-stamped price
// captured at that moment (priceAtLastEditEgp if it was edited, else
// priceAtCreationEgp), not the whole day's %, which would credit/blame the
// lot for market movement from before it existed at its current quantity.
// Returns null when no stamp is available (older data from before this
// stamping existed) so the caller can fall back to excluding the lot
// entirely, exactly like before this existed — never fabricates a baseline.
export function todayContributionFromStamp(
  stampedPricePerUnit: number | null | undefined,
  quantity: number,
  currentValueEGP: number,
): number | null {
  if (stampedPricePerUnit == null || !Number.isFinite(stampedPricePerUnit)) return null;
  return currentValueEGP - quantity * stampedPricePerUnit;
}
