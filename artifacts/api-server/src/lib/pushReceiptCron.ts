import { and, eq, lt, gt, sql } from "drizzle-orm";
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

// Alerting thresholds — added after a real incident (2026-09-08) where
// every push silently accepted a ticket but never got a receipt, for
// hours, and nobody knew until users reported it. Two different signals,
// because the incident's actual symptom (tickets stuck pending forever)
// wouldn't have shown up in a plain success/error ratio at all — nothing
// ever resolved to "error" that night, it just never resolved.
const STUCK_PENDING_MIN_AGE_MS = 30 * 60 * 1000; // well past the ~3-15 min receipts normally take
const STUCK_PENDING_ALERT_THRESHOLD = 10; // more than this many stuck this long is a real signal, not noise
const ERROR_RATE_ALERT_THRESHOLD = 0.5; // >50% of a resolved batch failing is worth a loud log
const ERROR_RATE_MIN_SAMPLE = 5; // don't alert on a tiny batch where one failure looks catastrophic

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
      const resolved = successCount + errorCount;
      if (resolved >= ERROR_RATE_MIN_SAMPLE && errorCount / resolved > ERROR_RATE_ALERT_THRESHOLD) {
        logger.error(
          { successCount, errorCount, errorRate: errorCount / resolved },
          "Push receipt cron: ALERT — high failure rate in this batch, investigate",
        );
      }
    }

    // The actual signature of the 2026-09-08 incident: tickets accepted
    // cleanly, never showing up as an "error" at all, just never resolving.
    // A plain success/error ratio above is blind to this — this is the
    // check that would have caught it, hours earlier than a user report.
    const stuckCutoff = new Date(now.getTime() - STUCK_PENDING_MIN_AGE_MS);
    const [{ count: stuckCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pushTicketsTable)
      .where(and(
        eq(pushTicketsTable.status, "pending"),
        lt(pushTicketsTable.sentAt, stuckCutoff),
        gt(pushTicketsTable.sentAt, giveUpCutoff),
      ));
    if (stuckCount > STUCK_PENDING_ALERT_THRESHOLD) {
      logger.error(
        { stuckCount, olderThanMinutes: STUCK_PENDING_MIN_AGE_MS / 60_000 },
        "Push receipt cron: ALERT — many tickets stuck pending with no receipt, delivery may be silently broken",
      );
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
