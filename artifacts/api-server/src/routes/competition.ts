import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cairoMonthStart, cairoWeekStart, tradingDayKey } from "../lib/cairoDate";
import { earliestSnapshotBefore, snapshotBefore, snapshotOnOrBefore } from "../lib/portfolioSnapshotHelpers";

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

// GET /api/competition/leaderboard?period=week|month — ranked by % portfolio
// return since the period's start (Africa/Cairo — see cairoWeekStart /
// cairoMonthStart), computed from portfolio_snapshots, which
// portfolioAlertCron.ts already writes for every user every 5 minutes
// regardless of any opt-in here. No new data collection, no cron of its own
// — this is a pure read, computed fresh on each request.
//
// "Today" MUST be tradingDayKey(), not a plain UTC or Cairo calendar date:
// portfolio_snapshots.date is itself written using tradingDayKey() (see
// portfolioAlertCron.ts), so any other definition of "today" can disagree
// with what's actually in the table. This was a real, live bug: a plain UTC
// `new Date().toISOString().slice(0,10)` lags tradingDayKey() by up to a
// couple of hours every single day (tradingDayKey rolls over at 22:00/23:00
// UTC, UTC's own calendar date only rolls at 00:00 UTC) — during that daily
// window `current` silently fell back to *yesterday's* snapshot even though
// a fresh one already existed, and on top of that it happened to collide
// with `weekStart` on Cairo's own Sunday, collapsing baseline === current
// and showing an exact 0% for every single participant. tradingDayKey() is
// the one definition of "today" that always matches the freshest row that's
// actually been written.
//
// The baseline is always the last snapshot from STRICTLY BEFORE periodStart
// (snapshotBefore), never "on or before" it. A change made during the
// period's own first day (e.g. a real portfolio edit made sometime Sunday)
// must count as part of that period's movement — using "on or before
// Sunday" as the baseline would instead pick up Sunday's own end-of-day
// value, silently absorbing that day's change into the baseline itself and
// making it invisible. Anchoring strictly before the period started (i.e.
// Saturday's closing value for the weekly view) is what makes every day of
// the period, including its first, actually count toward the shown return.
// This also incidentally avoids the same-day baseline === current collision
// (see portfolioSnapshotHelpers.ts) without needing a separate branch for it.
//
// A user whose tracking history doesn't reach back to periodStart at all
// (joined, or opted into competition tracking, partway through the week/
// month) falls back to their own earliest snapshot as the baseline instead
// of being excluded outright — see earliestSnapshotBefore's own comment.
// Without this, a monthly view early in most users' lifetime would rank
// almost nobody, which is exactly what was happening.
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
    const period = req.query.period === "month" ? "month" : "week";
    const periodStart = period === "month" ? cairoMonthStart() : cairoWeekStart();
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

    const today = tradingDayKey();
    const withReturns: { id: string; nickname: string; pctReturn: number }[] = [];
    for (const u of opted) {
      if (!u.nickname) continue;
      const baseline = (await snapshotBefore(u.id, periodStart)) ?? await earliestSnapshotBefore(u.id, today);
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
    res.json({ period, periodStart, top: ranked.slice(0, TOP_N), me, optedIn });
  } catch (err) {
    req.log.error({ err }, "GET /competition/leaderboard failed");
    res.status(500).json({ error: "Failed to load the leaderboard" });
  }
});

export default router;
