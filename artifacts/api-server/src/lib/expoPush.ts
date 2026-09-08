import { inArray } from "drizzle-orm";
import { db, usersTable, pushTicketsTable } from "@workspace/db";
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

interface ExpoTicket {
  status: "ok" | "error";
  id?: string; // present when status === 'ok'
  message?: string;
  details?: { error?: string };
}

function isValidExpoToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

function generateTicketRowId(): string {
  return `pt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
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
 *
 * Also records the real per-token outcome in push_tickets — see that
 * table's own comment for why this exists. Before this, the only check
 * here was the HTTP status of the request to Expo (`res.ok`), which stays
 * 200 even when an individual token comes back `DeviceNotRegistered` in
 * the response body — a dead token could sit in users.push_token forever
 * with every send against it silently doing nothing, invisible to logs,
 * the database, and this app's own code alike. A token that comes back
 * DeviceNotRegistered at this ticket stage is cleared immediately; a
 * token accepted here ('ok') still isn't confirmed *delivered* — only
 * pushReceiptCron.ts's later receipt check can confirm that.
 */
export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const valid = [...new Set(tokens.filter(isValidExpoToken))];
  if (valid.length === 0) return;

  const type = typeof data?.type === "string" ? data.type : "unknown";

  // One lookup per send, not per token — cheap at this app's scale, and the
  // only way to attribute a ticket to a user without changing every call
  // site's signature just to thread userId through. Best-effort: a token
  // that doesn't currently match any row (e.g. reassigned mid-flight) still
  // gets sent to and tracked, just with userId left null.
  let userIdByToken = new Map<string, string>();
  try {
    const rows = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(inArray(usersTable.pushToken, valid));
    userIdByToken = new Map(rows.filter(r => r.pushToken).map(r => [r.pushToken as string, r.id]));
  } catch (err) {
    logger.warn({ err }, "Expo push: token->user lookup failed, tickets will be recorded without userId");
  }

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
        continue;
      }

      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
      const tickets = json?.data;
      if (!Array.isArray(tickets) || tickets.length !== batch.length) {
        logger.warn({ batchSize: batch.length, got: tickets?.length }, "Expo push: unexpected response shape");
        continue;
      }

      const deadTokens: string[] = [];
      const rowsToInsert: (typeof pushTicketsTable.$inferInsert)[] = [];

      tickets.forEach((ticket, idx) => {
        const token = batch[idx];
        const userId = userIdByToken.get(token) ?? null;

        if (ticket.status === "error") {
          const errorCode = ticket.details?.error;
          logger.warn({ token, type, errorCode, message: ticket.message }, "Expo push: ticket error");
          if (errorCode === "DeviceNotRegistered") deadTokens.push(token);
          rowsToInsert.push({
            id: generateTicketRowId(),
            userId,
            token,
            type,
            status: "error",
            stage: "ticket",
            errorCode: errorCode ?? null,
            errorMessage: ticket.message ?? null,
            checkedAt: new Date(),
          });
        } else if (ticket.id) {
          // Accepted, not yet confirmed delivered — pushReceiptCron.ts
          // follows up on this row later.
          rowsToInsert.push({
            id: ticket.id,
            userId,
            token,
            type,
            status: "pending",
            stage: "ticket",
          });
        }
      });

      if (rowsToInsert.length > 0) {
        await db.insert(pushTicketsTable).values(rowsToInsert).onConflictDoNothing();
      }
      if (deadTokens.length > 0) {
        await db.update(usersTable).set({ pushToken: null, updatedAt: new Date() })
          .where(inArray(usersTable.pushToken, deadTokens));
        logger.info({ count: deadTokens.length }, "Expo push: cleared dead token(s) (DeviceNotRegistered)");
      }
    } catch (err) {
      logger.warn({ err, batchSize: batch.length }, "Expo push: request failed");
    }
  }
}

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPTS_BATCH_SIZE = 300; // Expo allows up to 1000; kept conservative

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/** Thin wrapper Expo's getReceipts endpoint — used by pushReceiptCron.ts. */
export async function fetchExpoReceipts(ticketIds: string[]): Promise<Record<string, ExpoReceipt>> {
  const out: Record<string, ExpoReceipt> = {};
  for (let i = 0; i < ticketIds.length; i += RECEIPTS_BATCH_SIZE) {
    const batch = ticketIds.slice(i, i + RECEIPTS_BATCH_SIZE);
    try {
      const res = await fetch(EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch }),
      });
      if (!res.ok) {
        logger.warn({ status: res.status, batchSize: batch.length }, "Expo receipts: non-OK response");
        continue;
      }
      const json = (await res.json().catch(() => null)) as { data?: Record<string, ExpoReceipt> } | null;
      Object.assign(out, json?.data ?? {});
    } catch (err) {
      logger.warn({ err, batchSize: batch.length }, "Expo receipts: request failed");
    }
  }
  return out;
}
