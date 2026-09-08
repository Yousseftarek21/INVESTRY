import { and, eq, lt, gt } from "drizzle-orm";
import { db, usersTable, pushTicketsTable } from "@workspace/db";
import { fetchExpoReceipts, errorCodeOf, DEAD_TOKEN_ERROR_CODES } from "./expoPush";
import { logger } from "./logger";

// Follows up on every push_tickets row still sitting at status='pending' —
// see that table's own comment for the two-stage (ticket/receipt) model
// this implements. A ticket's initial "ok" only means Expo accepted the
// send; this is the check that confirms Apple/Google actually delivered
// it, and the only place a token that goes stale *after* the ticket stage
// (the common real-world case: DeviceNotRegistered often only shows up
// here, not at send time) gets caught and cleared.
//
// Every 10 min — Expo recommends waiting "a few minutes" before fetching a
// receipt, and there is no cost to checking a little late; PENDING_MIN_AGE_MS
// below skips anything too fresh to have a receipt yet regardless of how
// often this runs.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const PENDING_MIN_AGE_MS = 3 * 60 * 1000; // give Apple/Google time before asking
// Expo only retains receipts for a limited window after sending; a ticket
// that's still unresolved after this long is never coming back — mark it
// 'unknown' (not 'error') so it stops being retried without falsely
// implying delivery failed. Also caps this table's growth of true pending
// rows.
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

let running = false;

async function checkReceipts(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const freshCutoff = new Date(now.getTime() - PENDING_MIN_AGE_MS);
    const giveUpCutoff = new Date(now.getTime() - GIVE_UP_AFTER_MS);

    // Give up on anything too old first — cheap, and keeps the "ready to
    // check" query below from repeatedly re-scanning rows Expo will never
    // answer for.
    await db.update(pushTicketsTable)
      .set({ status: "unknown", stage: "receipt", checkedAt: now })
      .where(and(eq(pushTicketsTable.status, "pending"), lt(pushTicketsTable.sentAt, giveUpCutoff)));

    const pending = await db
      .select({ id: pushTicketsTable.id, token: pushTicketsTable.token })
      .from(pushTicketsTable)
      .where(and(
        eq(pushTicketsTable.status, "pending"),
        lt(pushTicketsTable.sentAt, freshCutoff),
        gt(pushTicketsTable.sentAt, giveUpCutoff),
      ))
      .limit(BATCH_LIMIT);

    if (pending.length === 0) return;

    const receipts = await fetchExpoReceipts(pending.map(p => p.id));

    let successCount = 0, errorCount = 0;
    const deadTokens = new Set<string>();

    for (const row of pending) {
      const receipt = receipts[row.id];
      if (!receipt) continue; // not ready yet — left pending for a later run, until it ages past GIVE_UP_AFTER_MS

      if (receipt.status === "ok") {
        successCount++;
        await db.update(pushTicketsTable)
          .set({ status: "success", stage: "receipt", checkedAt: now })
          .where(eq(pushTicketsTable.id, row.id));
      } else {
        errorCount++;
        const errorCode = errorCodeOf(receipt.details);
        if (errorCode && DEAD_TOKEN_ERROR_CODES.has(errorCode)) deadTokens.add(row.token);
        await db.update(pushTicketsTable)
          .set({ status: "error", stage: "receipt", errorCode: errorCode ?? null, errorMessage: receipt.message ?? null, checkedAt: now })
          .where(eq(pushTicketsTable.id, row.id));
      }
    }

    if (deadTokens.size > 0) {
      for (const token of deadTokens) {
        await db.update(usersTable).set({ pushToken: null, updatedAt: now }).where(eq(usersTable.pushToken, token));
      }
      logger.info({ count: deadTokens.size }, "Push receipt cron: cleared dead token(s) at receipt stage");
    }
    if (successCount > 0 || errorCount > 0) {
      logger.info({ checked: pending.length, successCount, errorCount }, "Push receipt cron: processed a batch");
    }

    // Light retention — this table exists for diagnosis, not permanent
    // history; 30 days is far more than enough to answer "did push X land."
    const retentionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(pushTicketsTable).where(lt(pushTicketsTable.sentAt, retentionCutoff));
  } catch (err) {
    logger.warn({ err }, "Push receipt cron run failed");
  } finally {
    running = false;
  }
}

export function startPushReceiptCron(): void {
  checkReceipts();
  setInterval(checkReceipts, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Push receipt cron started");
}
