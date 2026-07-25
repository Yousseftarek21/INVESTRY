import Anthropic from "@anthropic-ai/sdk";

// Constructed lazily, on first actual use — never at module import time.
// Same reasoning as lib/stripe.ts: this file is imported unconditionally at
// server startup regardless of whether ANTHROPIC_API_KEY is configured yet,
// and an eager `new Anthropic()` with no key would take the whole process
// down at boot the same way the Stripe client once did.
let _anthropic: Anthropic | null = null;
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
