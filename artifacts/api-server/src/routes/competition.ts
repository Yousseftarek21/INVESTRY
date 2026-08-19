import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cairoWeekStart } from "../lib/cairoDate";
import { snapshotOnOrBefore } from "../lib/portfolioSnapshotHelpers";

const router: IRouter = Router();

router.use("/competition", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

const NICKNAME_MAX = 24;

// PUT /api/competition/join — opt in with a display nickname. Deliberately
// separate from the account's real name/email: this ranking is still real
// financial signal (a % return), so nobody should appear under an identity
// tied back to them without choosing a nickname specifically for it.
router.put("/competition/join", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = (req.body as Record<string, unknown>)?.nickname;
  const nickname = typeof raw === "string" ? raw.trim() : "";
  if (!nickname) { res.status(400).json({ error: "nickname is required" }); return; }
  if (nickname.length > NICKNAME_MAX) {
    res.status(400).json({ error: `nickname must be ${NICKNAME_MAX} characters or fewer` });
    return;
  }

  try {
    await db
      .insert(usersTable)
      .values({ id: userId, competitionNickname: nickname, competitionOptedIn: true })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { competitionNickname: nickname, competitionOptedIn: true, updatedAt: new Date() },
      });
    res.json({ success: true, nickname });
  } catch (err) {
    req.log.error({ err }, "PUT /competition/join failed");
    res.status(500).json({ error: "Failed to join the leaderboard" });
  }
});

// POST /api/competition/leave — opts out. Nickname is kept (not cleared) so
// rejoining doesn't ask for it again; only competitionOptedIn gates whether
// the user is actually queried for the leaderboard.
router.post("/competition/leave", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await db.update(usersTable).set({ competitionOptedIn: false, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "POST /competition/leave failed");
    res.status(500).json({ error: "Failed to leave the leaderboard" });
  }
});

const TOP_N = 50;

interface Ranked { nickname: string; pctReturn: number; rank: number; isMe: boolean }

// GET /api/competition/leaderboard — ranked by % portfolio return since this
// week's start (Sunday, Africa/Cairo — see cairoWeekStart), computed from
// portfolio_snapshots, which portfolioAlertCron.ts already writes for every
// user every 5 minutes regardless of any opt-in here. No new data collection,
// no cron of its own — this is a pure read, computed fresh on each request.
//
// Known, accepted limitation: holdings in this app are self-reported, not
// linked to a real brokerage, so this ranking can be gamed by entering a
// fake holding. No attempt is made to detect that for this first version —
// flagged here rather than silently ignored, and worth revisiting if it's
// ever actually abused.
router.get("/competition/leaderboard", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const weekStart = cairoWeekStart();
    const opted = await db
      .select({ id: usersTable.id, nickname: usersTable.competitionNickname })
      .from(usersTable)
      .where(eq(usersTable.competitionOptedIn, true));

    // Read directly, not inferred from ranking: a user who just joined and
    // has no portfolio_snapshots row yet (brand new, or simply hasn't had
    // one written this week) is genuinely opted in but can't be ranked —
    // conflating the two would show them the "join" screen again forever,
    // since they'd never appear in `me` below.
    const optedIn = opted.some(u => u.id === userId);

    // "Today" as a plain UTC date is fine as the upper bound here — unlike
    // the trading-day/Cairo-day distinction elsewhere in this app, a snapshot
    // lookup just needs *a* recent cutoff no earlier than the latest real
    // snapshot, and portfolio_snapshots is written multiple times a day.
    const today = new Date().toISOString().slice(0, 10);
    const withReturns: { id: string; nickname: string; pctReturn: number }[] = [];
    for (const u of opted) {
      if (!u.nickname) continue;
      const baseline = await snapshotOnOrBefore(u.id, weekStart);
      const current = await snapshotOnOrBefore(u.id, today);
      if (baseline == null || current == null) continue;
      withReturns.push({ id: u.id, nickname: u.nickname, pctReturn: ((current - baseline) / baseline) * 100 });
    }

    withReturns.sort((a, b) => b.pctReturn - a.pctReturn);

    const ranked: Ranked[] = withReturns.map((u, i) => ({
      nickname: u.nickname,
      pctReturn: Math.round(u.pctReturn * 100) / 100,
      rank: i + 1,
      isMe: u.id === userId,
    }));

    const me = ranked.find(r => r.isMe) ?? null;
    res.json({ weekStart, top: ranked.slice(0, TOP_N), me, optedIn });
  } catch (err) {
    req.log.error({ err }, "GET /competition/leaderboard failed");
    res.status(500).json({ error: "Failed to load the leaderboard" });
  }
});

export default router;
