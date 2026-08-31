import { and, eq, count, isNotNull, gte, lt, desc, sql } from "drizzle-orm";
import { db, usersTable, holdingsTable, cashAccountsTable, referralMonthlyWinnersTable } from "@workspace/db";
import { utcMonthStart, utcMonthStartKey } from "./calendarDate";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Checked once every 6h — cheap (an idempotency check guarded by
// referral_monthly_winners' own unique(month) constraint, short-circuiting
// before the full ranking query for the rest of the month once a winner is
// on record), and nothing about "did last month end" changes faster than
// that. Detects and crowns the previous month's top referrer the first time
// this runs after that month has actually ended — closes the gap between
// the app's own copy ("the top referrer each month wins a prize", see
// i18n's referralHeroSub/inviteFriendsNavSub) and there previously being
// zero code to identify, notify, or keep a record of who that is. Prize
// fulfillment itself stays manual/off-app — see referralMonthlyWinnersTable's
// own comment — this is the detection-and-record half only.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let running = false;

async function checkMonthlyWinner(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const thisMonthStart = utcMonthStart(now);
    const lastMonthStart = utcMonthStart(new Date(thisMonthStart.getTime() - 1));
    const lastMonthKey = utcMonthStartKey(lastMonthStart);

    const [existing] = await db
      .select({ id: referralMonthlyWinnersTable.id })
      .from(referralMonthlyWinnersTable)
      .where(eq(referralMonthlyWinnersTable.month, lastMonthKey));
    if (existing) return; // already crowned for this month — nothing to do until next month ends

    // Same ranking query as GET /referral/leaderboard?period=month — same
    // real-activity gate (at least one real holding or cash account), just
    // windowed to the month that just ended instead of the one in progress,
    // so the winner crowned here matches what that screen would have shown
    // on the last day of that month.
    const rows = await db
      .select({ referrerId: usersTable.referredByUserId, referredCount: count() })
      .from(usersTable)
      .where(and(
        isNotNull(usersTable.referredByUserId),
        gte(usersTable.referralRedeemedAt, lastMonthStart),
        lt(usersTable.referralRedeemedAt, thisMonthStart),
        sql`(
          EXISTS (SELECT 1 FROM ${holdingsTable} WHERE ${holdingsTable.userId} = ${usersTable.id})
          OR EXISTS (SELECT 1 FROM ${cashAccountsTable} WHERE ${cashAccountsTable.userId} = ${usersTable.id})
        )`,
      ))
      .groupBy(usersTable.referredByUserId)
      .orderBy(desc(count()))
      .limit(1);

    const winner = rows[0];
    if (!winner?.referrerId || winner.referredCount < 1) {
      // No real referrals that month — still write a "nobody won" row so
      // this doesn't re-scan every 6h for the rest of the month, but with
      // no userId to notify or credit.
      await db.insert(referralMonthlyWinnersTable).values({
        id: `refwin_${lastMonthKey}`,
        month: lastMonthKey,
        userId: "",
        referredCount: 0,
      }).onConflictDoNothing({ target: referralMonthlyWinnersTable.month });
      return;
    }

    const [user] = await db
      .select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(eq(usersTable.id, winner.referrerId));

    const monthLabel = lastMonthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    let notifiedAt: Date | null = null;
    if (user?.pushToken) {
      await sendPushToTokens(
        [user.pushToken],
        "🏆 You won this month's referral prize!",
        `You referred the most friends in ${monthLabel} — we'll be in touch about your prize soon.`,
        { type: "referral_monthly_winner" },
      );
      notifiedAt = new Date();
    }

    // onConflictDoNothing on the month-unique constraint, not a plain
    // insert: closes the same race a concurrent process restart could
    // otherwise hit between the existence check above and this write.
    await db.insert(referralMonthlyWinnersTable).values({
      id: `refwin_${lastMonthKey}`,
      month: lastMonthKey,
      userId: winner.referrerId,
      referredCount: winner.referredCount,
      notifiedAt,
    }).onConflictDoNothing({ target: referralMonthlyWinnersTable.month });

    logger.info(
      { month: lastMonthKey, userId: winner.referrerId, referredCount: winner.referredCount, notified: !!notifiedAt },
      "Crowned referral monthly winner",
    );
  } catch (err) {
    logger.warn({ err }, "Referral monthly winner cron run failed");
  } finally {
    running = false;
  }
}

export function startReferralMonthlyWinnerCron(): void {
  checkMonthlyWinner();
  setInterval(checkMonthlyWinner, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Referral monthly winner cron started");
}
