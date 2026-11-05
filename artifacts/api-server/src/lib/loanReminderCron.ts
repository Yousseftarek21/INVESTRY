import { sql } from "drizzle-orm";
import { db, usersTable, loansTable } from "@workspace/db";
import { decryptFromStorage } from "./encryption";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";
import { cairoDateString } from "./cairoDate";
import { fmtAmount, loanDueTomorrow, pushLang } from "./pushText";

// "Your loan payment is due tomorrow" — once per loan per month, the day
// before its due day, unless that month is already marked paid. Gated on
// activityAlertsEnabled like the other personal reminders. Sent at 10:00
// Cairo, same window as rentalReminderCron.ts.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SEND_HOUR_CAIRO = 10;

function cairoHour(d: Date = new Date()): number {
  return Number(d.toLocaleString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }));
}

const DAY_MS = 86_400_000;
const dayIso = (iso: string, add: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + add * DAY_MS).toISOString().slice(0, 10);

interface StoredLoan {
  name?: string;
  startBalance?: number;
  monthlyPayment?: number;
  currency?: string;
  dueDay?: number;
  startDate?: string;
  endDate?: string;
  payments?: Array<{ amount?: number; month?: string }>;
}

let running = false;

async function checkAll(): Promise<void> {
  if (running) return;
  if (cairoHour() !== SEND_HOUR_CAIRO) return;
  running = true;
  try {
    const tomorrow = dayIso(cairoDateString(), 1);
    const ym = tomorrow.slice(0, 7);
    const day = Number(tomorrow.slice(8, 10));

    const rows = await db.select().from(loansTable);
    if (rows.length === 0) return;
    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, activityAlertsEnabled: usersTable.activityAlertsEnabled, language: usersTable.language })
      .from(usersTable);
    const tokenFor = new Map(users.filter(u => u.pushToken && u.activityAlertsEnabled).map(u => [u.id, u.pushToken as string]));
    const langFor = new Map(users.map(u => [u.id, pushLang(u.language)]));

    for (const row of rows) {
      const token = tokenFor.get(row.userId);
      if (!token) continue;
      try {
        const l = decryptFromStorage(row.data) as StoredLoan;
        if (!l.dueDay || l.dueDay !== day) continue;
        if (l.startDate && l.startDate > tomorrow) continue;
        if (l.endDate && l.endDate < tomorrow) continue;
        const paid = (l.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        if ((Number(l.startBalance) || 0) - paid <= 0.5) continue;           // paid off
        if ((l.payments ?? []).some(p => p.month === ym)) continue;           // this month already paid

        const key = `due:${row.id}:${ym}`;
        const claimed = await db.execute(sql`
          INSERT INTO "loan_reminders_sent" ("id", "user_id") VALUES (${key}, ${row.userId})
          ON CONFLICT ("id") DO NOTHING RETURNING "id"
        `);
        if ((claimed.rows?.length ?? 0) === 0) continue;

        const left = (Number(l.startBalance) || 0) - paid;
        const pay = l.monthlyPayment ? Math.min(l.monthlyPayment, left) : null;
        const lang = langFor.get(row.userId) ?? "en";
        const msg = loanDueTomorrow(
          lang,
          l.name || (lang === "ar" ? "القرض" : "Loan"),
          pay ? fmtAmount(pay) : null,
          pay && left - pay > 0.5 ? fmtAmount(left - pay) : null,
          l.currency ?? "EGP",
        );
        await sendPushToTokens([token], msg.title, msg.body, { type: "loan_reminder", loanId: row.id });
      } catch (err) {
        logger.warn({ err, loanId: row.id }, "Loan reminder failed for entry");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Loan reminder cron run failed");
  } finally {
    running = false;
  }
}

export function startLoanReminderCron(): void {
  checkAll();
  setInterval(checkAll, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, sendHourCairo: SEND_HOUR_CAIRO }, "Loan reminder cron started");
}
