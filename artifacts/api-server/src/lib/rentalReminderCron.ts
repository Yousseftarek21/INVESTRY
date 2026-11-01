import { sql } from "drizzle-orm";
import { db, usersTable, rentalUnitsTable, rentalBookingsTable, rentalLeasesTable } from "@workspace/db";
import { decryptFromStorage } from "./encryption";
import { sendPushToTokens } from "./expoPush";
import { isUserPro } from "./isUserPro";
import { logger } from "./logger";
import { cairoDateString } from "./cairoDate";

// Rental Properties nudges (Pro only, gated on activityAlertsEnabled like
// pendingIncomeReminderCron.ts): a guest checks in tomorrow, rent is due
// today, rent is 3 days late, a contract ends within 30 days.
//
// "Already sent" lives in its own table keyed by event, not on the stored
// record: the app rewrites a booking/lease's whole blob on every edit, so a
// marker kept there would be wiped and the push would repeat.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SEND_HOUR_CAIRO = 10;
const LATE_AFTER_DAYS = 3;
const LEASE_END_NOTICE_DAYS = 30;

function cairoHour(d: Date = new Date()): number {
  return Number(d.toLocaleString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }));
}

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const dayIso = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const monthOf = (iso: string) => iso.slice(0, 7);

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

interface StoredUnit { name?: string; archived?: boolean }
interface StoredBooking { checkIn?: string; checkOut?: string; status?: string; guestName?: string }
interface StoredLease {
  tenantName?: string;
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  annualIncreasePct?: number;
  currency?: string;
  dueDay?: number;
  payments?: Array<{ month?: string; amount?: number; waived?: boolean }>;
}

// Same rules as the app's utils/rentalMath.ts (leaseRentFor / dueDateFor).
function rentFor(l: StoredLease, ym: string): number {
  const years = Math.max(0, Math.floor(monthsBetween(monthOf(l.startDate!), ym) / 12));
  return Math.round((l.monthlyRent ?? 0) * Math.pow(1 + (l.annualIncreasePct || 0) / 100, years) * 100) / 100;
}
function dueDateFor(l: StoredLease, ym: string): string {
  const due = `${ym}-${String(Math.min(Math.max(l.dueDay || 1, 1), 28)).padStart(2, "0")}`;
  return ym === monthOf(l.startDate!) && due < l.startDate! ? l.startDate! : due;
}
function monthSettled(l: StoredLease, ym: string): boolean {
  const payments = (l.payments ?? []).filter(p => p.month === ym);
  if (payments.some(p => p.waived)) return true;
  const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  return paid >= rentFor(l, ym) - 0.005;
}
function inLease(l: StoredLease, iso: string): boolean {
  return !!l.startDate && l.startDate <= iso && (!l.endDate || l.endDate >= iso);
}

interface Reminder { key: string; userId: string; title: string; body: string }

/** Records the event as sent; true only the first time. */
async function claim(key: string, userId: string): Promise<boolean> {
  const res = await db.execute(sql`
    INSERT INTO "rental_reminders_sent" ("id", "user_id") VALUES (${key}, ${userId})
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
  `);
  return (res.rows?.length ?? 0) > 0;
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return;
  if (cairoHour() !== SEND_HOUR_CAIRO) return;
  running = true;
  try {
    const today = cairoDateString();
    const todayN = dayNum(today);
    const tomorrow = dayIso(todayN + 1);

    const units = await db.select().from(rentalUnitsTable);
    if (units.length === 0) return;

    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, activityAlertsEnabled: usersTable.activityAlertsEnabled, plan: usersTable.plan, proCreditExpiresAt: usersTable.proCreditExpiresAt })
      .from(usersTable);
    const eligible = new Map(users
      .filter(u => u.pushToken && u.activityAlertsEnabled && isUserPro(u))
      .map(u => [u.id, u.pushToken as string]));

    const unitName = new Map<string, string>();
    for (const row of units) {
      if (!eligible.has(row.userId)) continue;
      try {
        const u = decryptFromStorage(row.data) as StoredUnit;
        if (!u.archived) unitName.set(row.id, u.name || "your unit");
      } catch (err) {
        logger.warn({ err, unitId: row.id }, "Rental reminder: unreadable unit");
      }
    }
    if (unitName.size === 0) return;

    const reminders: Reminder[] = [];

    for (const row of await db.select().from(rentalBookingsTable)) {
      const name = unitName.get(row.unitId);
      if (!name || !eligible.has(row.userId)) continue;
      try {
        const b = decryptFromStorage(row.data) as StoredBooking;
        if (b.status === "cancelled" || b.checkIn !== tomorrow) continue;
        reminders.push({
          key: `checkin:${row.id}:${b.checkIn}`,
          userId: row.userId,
          title: "Check-in tomorrow",
          body: `${b.guestName ? `${b.guestName} checks in` : "A guest checks in"} at ${name} tomorrow.`,
        });
      } catch (err) {
        logger.warn({ err, bookingId: row.id }, "Rental reminder: unreadable booking");
      }
    }

    for (const row of await db.select().from(rentalLeasesTable)) {
      const name = unitName.get(row.unitId);
      if (!name || !eligible.has(row.userId)) continue;
      try {
        const l = decryptFromStorage(row.data) as StoredLease;
        if (!l.startDate || typeof l.monthlyRent !== "number" || l.monthlyRent <= 0) continue;
        const who = l.tenantName || "Your tenant";
        const cur = l.currency || "EGP";

        // Due today.
        const ym = monthOf(today);
        if (dueDateFor(l, ym) === today && inLease(l, today) && !monthSettled(l, ym)) {
          reminders.push({
            key: `rentdue:${row.id}:${ym}`,
            userId: row.userId,
            title: "Rent due today",
            body: `${who}'s rent of ${fmtAmount(rentFor(l, ym))} ${cur} for ${name} is due today.`,
          });
        }

        // Late — checks the month whose due date was LATE_AFTER_DAYS ago, so
        // a due date late in the previous month is still caught.
        const lateDay = dayIso(todayN - LATE_AFTER_DAYS);
        const lateYm = monthOf(lateDay);
        if (dueDateFor(l, lateYm) === lateDay && inLease(l, lateDay) && !monthSettled(l, lateYm)) {
          reminders.push({
            key: `rentlate:${row.id}:${lateYm}`,
            userId: row.userId,
            title: "Rent overdue",
            body: `${who}'s rent for ${name} was due ${LATE_AFTER_DAYS} days ago and isn't marked paid.`,
          });
        }

        // Contract ending soon.
        if (l.endDate && l.endDate >= today) {
          const daysLeft = dayNum(l.endDate) - todayN;
          if (daysLeft <= LEASE_END_NOTICE_DAYS && l.startDate <= today) {
            reminders.push({
              key: `leaseend:${row.id}:${l.endDate}`,
              userId: row.userId,
              title: "Contract ending soon",
              body: `${who}'s contract for ${name} ends ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}.`,
            });
          }
        }
      } catch (err) {
        logger.warn({ err, leaseId: row.id }, "Rental reminder: unreadable lease");
      }
    }

    for (const r of reminders) {
      try {
        // Claimed before sending, same reasoning as pendingIncomeReminderCron.ts.
        if (!(await claim(r.key, r.userId))) continue;
        await sendPushToTokens([eligible.get(r.userId)!], r.title, r.body, { type: "rental_reminder" });
      } catch (err) {
        logger.warn({ err, key: r.key }, "Rental reminder send failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Rental reminder cron run failed");
  } finally {
    running = false;
  }
}

export function startRentalReminderCron(): void {
  checkAllUsers();
  setInterval(checkAllUsers, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, sendHourCairo: SEND_HOUR_CAIRO }, "Rental reminder cron started");
}
