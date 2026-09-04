import { and, inArray, isNull, lte, ne } from "drizzle-orm";
import { db, usersTable, activityLogTable } from "@workspace/db";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// Everyone who existed before the paywall went live was able to use Pro
// features for free (BETA_UNLOCK_ALL was true). That's now off and the
// paywall is fully live — confirmed no gating code needed to change at
// all, every gate already fires correctly. What was missing is purely
// informational: those users will only discover the change by tapping
// something and hitting a paywall with no context. This sends a one-time
// notice explaining that, once, to exactly that population.
//
// Deliberately sent to every pre-existing free-plan user, not just ones
// found to already have pro-tier data (goals/holdings/etc. beyond the
// free limit) — a real audit of the app's own Free-vs-Pro feature list
// (constants/subscriptionFeatures.ts, mobile) found a whole cluster of
// full-lock features (AI Assistant, Portfolio Analytics and everything
// under it) with no usage history to check: someone who used the AI
// Assistant daily and someone who never opened it are indistinguishable
// in the database. Since that group can't be precisely targeted, and
// erring toward over-informing beats missing someone who genuinely lost
// access, this goes to the whole free-plan population instead of a
// filtered subset.
//
// Same one-time-broadcast pattern as sendCompetitionAnnouncement():
// self-limiting via proGateNoticeSentAt (only null rows match, set right
// after sending), safe to run on every boot forever, no manual removal
// ever needed. The one thing that pattern doesn't need but this one does:
// a hardcoded cutoff on createdAt. Without it, someone signing up next
// week would also match plan !== "pro" AND proGateNoticeSentAt IS NULL,
// and would wrongly be told "your plan has changed" when they never had
// Pro access to lose in the first place. Everything before this line
// shipped is "existing"; everything after is a normal new signup that
// gets the standard immediate paywall and no notice at all.
const PRE_PAYWALL_CUTOFF = new Date("2026-09-04T23:59:59Z");

function proGateActivityId(userId: string): string {
  return `act_pro_gate_${userId}`;
}

export async function sendProGateNotice(): Promise<void> {
  try {
    const rows = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(and(
        ne(usersTable.plan, "pro"),
        isNull(usersTable.proGateNoticeSentAt),
        lte(usersTable.createdAt, PRE_PAYWALL_CUTOFF),
      ));

    if (rows.length === 0) return;

    const title = "Your plan has changed";
    const subtitle = "Some of what you've saved needs Pro now — subscribe to keep adding or editing it.";

    const tokens = rows.map(r => r.pushToken).filter((t): t is string => !!t);
    if (tokens.length > 0) {
      await sendPushToTokens(tokens, title, subtitle, { type: "pro_gate_notice" });
    }

    // Also lands in the in-app bell for every affected user, not just the
    // ones with a push token — same dual-delivery shape as every other
    // notification type in this app (see portfolioAlertCron.ts).
    for (const row of rows) {
      try {
        await db.insert(activityLogTable)
          .values({ id: proGateActivityId(row.id), userId: row.id, type: "pro_gate_notice", title, subtitle })
          .onConflictDoNothing();
      } catch (err) {
        logger.warn({ err, userId: row.id }, "sendProGateNotice: activity log write failed for user");
      }
    }

    await db
      .update(usersTable)
      .set({ proGateNoticeSentAt: new Date() })
      .where(inArray(usersTable.id, rows.map(r => r.id)));

    logger.info({ count: rows.length }, "Sent pro-gate notice to pre-existing free-plan users");
  } catch (err) {
    logger.error({ err }, "sendProGateNotice failed");
  }
}
