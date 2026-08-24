import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cairoMonthStart, cairoWeekStart, tradingDayKey } from "../lib/cairoDate";
import { earliestSnapshotBefore, snapshotBefore, snapshotOnOrBefore } from "../lib/portfolioSnapshotHelpers";
import { fetchIdentities, FALLBACK_NAME } from "../lib/clerkIdentity";

const router: IRouter = Router();

router.use("/competition", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// PUT /api/competition/join — opt in. Identity shown on the leaderboard is
// the account's real Clerk name/photo (see fetchIdentities) — no nickname
// to collect, so joining is just a flag flip.
router.put("/competition/join", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await db
      .insert(usersTable)
      .values({ id: userId, competitionOptedIn: true })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { competitionOptedIn: true, updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "PUT /competition/join failed");
    res.status(500).json({ error: "Failed to join the leaderboard" });
  }
});

// POST /api/competition/leave — opts out. competitionOptedIn alone gates
// whether the user is actually queried for the leaderboard.
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

interface Ranked { userId: string; name: string; imageUrl: string | null; pctReturn: number; rank: number; isMe: boolean }

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
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.competitionOptedIn, true));

    // Read directly, not inferred from ranking: a user who just joined and
    // has no portfolio_snapshots row yet (brand new, or simply hasn't had
    // one written this week) is genuinely opted in but can't be ranked —
    // conflating the two would show them the "join" screen again forever,
    // since they'd never appear in `me` below.
    const optedIn = opted.some(u => u.id === userId);

    const today = tradingDayKey();
    const withReturns: { id: string; pctReturn: number }[] = [];
    for (const u of opted) {
      const baseline = (await snapshotBefore(u.id, periodStart)) ?? await earliestSnapshotBefore(u.id, today);
      const current = await snapshotOnOrBefore(u.id, today);
      if (baseline == null || current == null) continue;
      withReturns.push({ id: u.id, pctReturn: ((current - baseline) / baseline) * 100 });
    }

    withReturns.sort((a, b) => b.pctReturn - a.pctReturn);

    const rankedIds = withReturns.map((u, i) => ({ id: u.id, pctReturn: Math.round(u.pctReturn * 100) / 100, rank: i + 1 }));
    const top = rankedIds.slice(0, TOP_N);
    const meRow = rankedIds.find(r => r.id === userId) ?? null;

    // Only fetch identities for ids actually displayed (top N + me, at most
    // TOP_N + 1) — never the full opted-in list, well under Clerk's 500-id
    // batch cap regardless of how many users are opted in.
    const idsToFetch = [...new Set([...top.map(u => u.id), ...(meRow ? [meRow.id] : [])])];
    const identities = await fetchIdentities(idsToFetch);

    const toEntry = (u: { id: string; pctReturn: number; rank: number }): Ranked => {
      const identity = identities.get(u.id) ?? { name: FALLBACK_NAME, imageUrl: null };
      return { userId: u.id, name: identity.name, imageUrl: identity.imageUrl, pctReturn: u.pctReturn, rank: u.rank, isMe: u.id === userId };
    };

    const me = meRow ? toEntry(meRow) : null;
    res.json({ period, periodStart, top: top.map(toEntry), me, optedIn });
  } catch (err) {
    req.log.error({ err }, "GET /competition/leaderboard failed");
    res.status(500).json({ error: "Failed to load the leaderboard" });
  }
});

export default router;
