import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { sendPushToTokens } from "./expoPush";
import { logger } from "./logger";

// One-time launch announcement for the leaderboard/competition feature.
// Runs at every boot, but is self-limiting via competitionAnnouncementSentAt:
// only users where it's still null get pushed, and it's set right after
// sending, so a redeploy or restart never re-sends. No new admin route or
// secret needed for what is otherwise a single manual broadcast — this
// sandbox has no direct production DB or Render access, so "the deployed
// server does it once at boot" is the only idempotent path available.
export async function sendCompetitionAnnouncement(): Promise<void> {
  try {
    const rows = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken, language: usersTable.language })
      .from(usersTable)
      .where(and(isNotNull(usersTable.pushToken), isNull(usersTable.competitionAnnouncementSentAt)));

    if (rows.length === 0) return;

    const enTokens = rows.filter(r => r.language !== "ar").map(r => r.pushToken!).filter(Boolean);
    const arTokens = rows.filter(r => r.language === "ar").map(r => r.pushToken!).filter(Boolean);
    await Promise.all([
      enTokens.length > 0
        ? sendPushToTokens(enTokens, "New: Weekly Challenge 🏆", "Compete with other investors on % return — join free from the app.", { type: "competition_announcement" })
        : Promise.resolve(),
      arTokens.length > 0
        ? sendPushToTokens(arTokens, "جديد: التحدي الأسبوعي 🏆", "نافس مستثمرين آخرين على نسبة العائد — انضم مجانًا من التطبيق.", { type: "competition_announcement" })
        : Promise.resolve(),
    ]);

    await db
      .update(usersTable)
      .set({ competitionAnnouncementSentAt: new Date() })
      .where(inArray(usersTable.id, rows.map(r => r.id)));

    logger.info({ count: rows.length }, "Sent competition launch announcement");
  } catch (err) {
    logger.error({ err }, "sendCompetitionAnnouncement failed");
  }
}
