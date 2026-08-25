import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchIdentities, FALLBACK_NAME } from "../lib/clerkIdentity";
import { computeRankedReturns } from "../lib/leaderboardRanking";
import { cairoWeekStart } from "../lib/cairoDate";
import { utcMonthStartKey } from "../lib/calendarDate";

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

// GET /api/competition/leaderboard?period=week|month — ranked by % return
// since the period's start — week is Africa/Cairo's Sun-Thu banking week
// (cairoWeekStart), month is the true calendar month (utcMonthStartKey,
// resets on the 1st, same boundary the referral prize window uses).
//
// The ranking itself (computeRankedReturns -> computePeriodPerformance in
// leaderboardRanking.ts/portfolioValue.ts) is restricted to gold, silver,
// and EGX stocks, and no longer reads portfolio_snapshots at all — it's
// computed fresh from real historical gold/silver prices
// (market_close_snapshots) and live stock data every time this route is
// called. See computePeriodPerformance's own comment for the full history
// of why: three straight production incidents (a single user's +853% from
// one newly-added property, then >100%/-100% swings once cost-basis or
// exclusion-based protections were tried) all traced back to real
// estate/personal-asset/fixed-income values being entirely self-reported
// with no independent price feed to check them against, on an app young
// enough that most users' whole portfolios were added within days of any
// period boundary. Restricting to the three types with real market prices
// (and computing gold/silver's contribution as a pure price ratio, immune
// to quantity gaming — see that function) removes the actual mechanism
// behind all three incidents, rather than trying to detect misuse of it.
//
// Known, accepted limitation: a stock holding's own cost basis is still
// user-entered and could be backdated, same category of issue as before
// but narrower — EGX prices are public and checkable, unlike a self-reported
// property valuation. A stock bought during the period itself is excluded
// from the ratio entirely rather than guessed at.
router.get("/competition/leaderboard", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const period = req.query.period === "month" ? "month" : "week";
    const periodStart = period === "month" ? utcMonthStartKey() : cairoWeekStart();

    // Read directly, not inferred from ranking: a user who just joined and
    // has no portfolio_snapshots row yet (brand new, or simply hasn't had
    // one written this week) is genuinely opted in but can't be ranked —
    // conflating the two would show them the "join" screen again forever,
    // since they'd never appear in `me` below.
    const [self] = await db
      .select({ competitionOptedIn: usersTable.competitionOptedIn })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const optedIn = self?.competitionOptedIn ?? false;

    const rankedIds = await computeRankedReturns(period);
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
