import { and, desc, eq, lt, lte } from "drizzle-orm";
import { db, usersTable, portfolioSnapshotsTable } from "@workspace/db";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";
import { cairoDateString } from "./cairoDate";

// Replaces a client-scheduled local notification that fired every morning
// with hardcoded, content-free text ("Good morning! Check your portfolio
// performance for today.") — same string, forever, regardless of what
// actually happened. This computes a real number from the same
// portfolio_snapshots table portfolioAlertCron.ts already writes every 5
// minutes for every user, push-enabled or not, so no new data collection is
// needed — only a new read of what's already there.
//
// A morning digest is a genuinely different concept from the trading-day
// boundary (18:00 New York, see cairoDate.ts) used everywhere else in this
// app: it is a habitual, human-morning notion, so it is keyed to Cairo's own
// calendar day rather than the trading day. Polled on the same 5-minute
// cadence as portfolioAlertCron for the same reason (no faster external
// dependency to justify tighter polling), gated to fire within one hour
// after the target time rather than continuously.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SEND_HOUR_CAIRO = 9; // 09:00-09:59 Cairo, both daily and weekly
const WEEKLY_WEEKDAY = 1; // Monday, Africa/Cairo

function cairoHour(d: Date = new Date()): number {
  return Number(d.toLocaleString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }));
}

// 0=Sunday..6=Saturday, in Africa/Cairo — Intl doesn't expose weekday as a
// number directly, so it's derived from the same en-CA date string cairoDate
// already uses elsewhere, parsed as a UTC date purely to read a weekday off
// it (the date itself, not the time, is what's being asked about).
function cairoWeekday(d: Date = new Date()): number {
  return new Date(`${cairoDateString(d)}T00:00:00Z`).getUTCDay();
}

function daysBeforeKey(dateKey: string, days: number): string {
  return new Date(new Date(`${dateKey}T00:00:00Z`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

// Short EGP figure for a push body ("245.3k EGP"), not the full integer —
// matches the compact style used throughout the app itself (utils/formatNumber.ts).
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2).replace(/\.?0+$/, "")}k`;
  return n.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

function pctBody(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const dir = pct >= 0 ? "+" : "";
  return `${dir}${pct.toFixed(1)}% · ${fmtCompact(current)} EGP`;
}

async function latestSnapshot(userId: string, onOrBefore: string): Promise<number | null> {
  const [row] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lte(portfolioSnapshotsTable.date, onOrBefore)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row.totalValue : null;
}

async function priorSnapshot(userId: string, before: string): Promise<number | null> {
  const [row] = await db
    .select({ totalValue: portfolioSnapshotsTable.totalValue })
    .from(portfolioSnapshotsTable)
    .where(and(eq(portfolioSnapshotsTable.userId, userId), lt(portfolioSnapshotsTable.date, before)))
    .orderBy(desc(portfolioSnapshotsTable.date))
    .limit(1);
  return row && row.totalValue > 0 ? row.totalValue : null;
}

interface User {
  id: string;
  pushToken: string | null;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  lastDaily: string | null;
  lastWeekly: string | null;
}

async function sendDaily(u: User, today: string): Promise<void> {
  if (!u.dailyEnabled || !u.pushToken || u.lastDaily === today) return;

  const current = await latestSnapshot(u.id, today);
  const baseline = await priorSnapshot(u.id, today);
  if (current == null || baseline == null) return; // nothing real to report yet

  // Marked sent before the push call, not after: a push that fails after
  // this point should not retry every tick for the rest of the send window
  // and risk a duplicate if the failure was transient rather than total.
  await db.update(usersTable).set({ lastDailySummaryDate: today }).where(eq(usersTable.id, u.id));
  await sendPushToTokens([u.pushToken], "Good morning", pctBody(current, baseline), { type: "daily_summary" });
}

async function sendWeekly(u: User, today: string): Promise<void> {
  if (!u.weeklyEnabled || !u.pushToken || u.lastWeekly === today) return;
  if (cairoWeekday() !== WEEKLY_WEEKDAY) return;

  const current = await latestSnapshot(u.id, today);
  const baseline = await latestSnapshot(u.id, daysBeforeKey(today, 7));
  if (current == null || baseline == null) return;

  await db.update(usersTable).set({ lastWeeklySummaryDate: today }).where(eq(usersTable.id, u.id));
  await sendPushToTokens([u.pushToken], "Your week in review", pctBody(current, baseline), { type: "weekly_summary" });
}

let running = false;

async function checkAllUsers(): Promise<void> {
  if (running) return;
  if (cairoHour() !== SEND_HOUR_CAIRO) return; // outside the 09:00-09:59 Cairo window entirely
  running = true;
  try {
    const today = cairoDateString();
    const users = await db
      .select({
        id: usersTable.id,
        pushToken: usersTable.pushToken,
        dailyEnabled: usersTable.dailySummaryEnabled,
        weeklyEnabled: usersTable.weeklySummaryEnabled,
        lastDaily: usersTable.lastDailySummaryDate,
        lastWeekly: usersTable.lastWeeklySummaryDate,
      })
      .from(usersTable);

    for (const u of users) {
      try {
        await sendDaily(u, today);
        await sendWeekly(u, today);
      } catch (err) {
        logger.warn({ err, userId: u.id }, "Daily/weekly summary failed for user");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Daily/weekly summary cron run failed");
  } finally {
    running = false;
  }
}

export function startDailySummaryCron(): void {
  checkAllUsers();
  setInterval(checkAllUsers, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, sendHourCairo: SEND_HOUR_CAIRO }, "Daily/weekly summary cron started");
}
