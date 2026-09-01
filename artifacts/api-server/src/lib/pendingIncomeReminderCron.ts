import { eq } from "drizzle-orm";
import { db, usersTable, recurringIncomeTable } from "@workspace/db";
import { encryptForStorage, decryptFromStorage } from "./encryption";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";
import { cairoDateString } from "./cairoDate";

// A pending (receivable) income entry with an expectedDate just sat there
// silently forever, even once that date arrived — nothing ever prompted the
// user to go check whether they'd actually been paid. This fires once per
// entry, the day its expectedDate arrives (or, if the cron missed a day,
// the next time it runs — expectedDate <= today, not === today, so a gap
// in server uptime doesn't silently skip the reminder).
//
// Deliberately no mention of who owes the money — see recurring-income.tsx's
// own IncomeKind docs: the "name" field is who the debt is with, which is
// more personal than an amount and unnecessary for the nudge to do its job.
//
// Gated on activityAlertsEnabled (the same toggle "you just added/edited X"
// confirmations use), not a dedicated flag — this is the same category of
// personal nudge, not a market alert, and defaults true so it reaches users
// without a separate opt-in.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SEND_HOUR_CAIRO = 10; // staggered an hour after the 09:00 daily summary

function cairoHour(d: Date = new Date()): number {
  return Number(d.toLocaleString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }));
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

interface StoredIncome {
  kind?: "recurring" | "pending";
  collected?: boolean;
  expectedDate?: string;
  amount?: number;
  currency?: string;
  reminderSentAt?: string;
  [key: string]: unknown;
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return;
  if (cairoHour() !== SEND_HOUR_CAIRO) return; // outside the 10:00-10:59 Cairo window entirely
  running = true;
  try {
    const today = cairoDateString();

    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, activityAlertsEnabled: usersTable.activityAlertsEnabled })
      .from(usersTable);
    const userById = new Map(users.map(u => [u.id, u]));

    const rows = await db.select().from(recurringIncomeTable);

    for (const row of rows) {
      try {
        const user = userById.get(row.userId);
        if (!user || !user.pushToken || !user.activityAlertsEnabled) continue;

        const income = decryptFromStorage(row.data) as StoredIncome;
        if (income.kind !== "pending" || income.collected) continue;
        if (!income.expectedDate || income.expectedDate > today) continue;
        if (income.reminderSentAt) continue;

        const amount = typeof income.amount === "number" ? income.amount : 0;
        const currency = income.currency ?? "EGP";
        const dateClause = income.expectedDate === today ? "today" : `on ${income.expectedDate}`;

        // Marked sent before the push call, not after: a push that fails
        // after this point should not retry every tick for the rest of the
        // send window and risk a duplicate if the failure was transient
        // rather than total — same reasoning as dailySummaryCron.ts.
        await db.update(recurringIncomeTable)
          .set({ data: encryptForStorage({ ...income, reminderSentAt: today }), updatedAt: new Date() })
          .where(eq(recurringIncomeTable.id, row.id));

        await sendPushToTokens(
          [user.pushToken],
          "Pending payment reminder",
          `A pending payment of ${fmtAmount(amount)} ${currency} was expected ${dateClause} — did it arrive? Check Income.`,
          { type: "pending_income_reminder" },
        );
      } catch (err) {
        logger.warn({ err, rowId: row.id }, "Pending income reminder failed for entry");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Pending income reminder cron run failed");
  } finally {
    running = false;
  }
}

export function startPendingIncomeReminderCron(): void {
  checkAllUsers();
  setInterval(checkAllUsers, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, sendHourCairo: SEND_HOUR_CAIRO }, "Pending income reminder cron started");
}
