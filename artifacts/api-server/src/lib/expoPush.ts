import { logger } from "./logger";

// ─── Expo Push API ────────────────────────────────────────────────────────────
// Plain HTTP calls to Expo's push service — no SDK needed. Docs:
// https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo's per-request limit

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

function isValidExpoToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

/**
 * Sends the same title/body to a batch of Expo push tokens. Invalid tokens
 * are skipped up front (rather than sent, which Expo would reject anyway),
 * and duplicate token values are collapsed to one send each — the same
 * physical device's token can end up attached to more than one user row
 * (e.g. a duplicate account created during troubleshooting), and callers
 * that gather tokens across multiple users (broadcasts) have no way to
 * know that from their side. Deduping here, once, protects every current
 * and future caller instead of relying on each one to do it themselves.
 * Best-effort: failures are logged, never thrown — a notification push
 * should never take down the caller (a cron tick, a route handler, etc).
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const valid = [...new Set(tokens.filter(isValidExpoToken))];
  if (valid.length === 0) return;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const messages: ExpoPushMessage[] = batch.map(to => ({ to, title, body, data, sound: "default" }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        logger.warn({ status: res.status, batchSize: batch.length }, "Expo push: non-OK response");
      }
    } catch (err) {
      logger.warn({ err, batchSize: batch.length }, "Expo push: request failed");
    }
  }
}
