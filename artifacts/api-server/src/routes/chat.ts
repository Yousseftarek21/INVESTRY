import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import {
  db,
  usersTable,
  holdingsTable,
  cashAccountsTable,
  goalsTable,
  portfolioSnapshotsTable,
  priceAlertsTable,
  recurringIncomeTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { decryptFromStorage } from "../lib/encryption";
import { fetchPrices, fetchStocks, type EGXStockResponse } from "./markets";
import { computeHoldingValue, type StoredHolding } from "../lib/portfolioValue";
import { fetchInflation } from "./inflation";
import { RE_PRICES } from "../lib/egyptRealEstatePrices";

const router: IRouter = Router();

// Require a valid Clerk session for the chat route
router.use("/chat", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// A single chat message triggers a real, paid Claude API call — cap per
// user well below the app-wide IP limiter in app.ts, which exists for a
// different purpose (abuse from a shared IP, not per-account cost control).
router.use(
  "/chat",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getAuth(req).userId ?? "anonymous",
  }),
);

type DecodedRow = { type: string } & Record<string, unknown>;

// Cost basis per holding type, mirrored from how each type's own "amount
// paid" field is named — used to show unrealized gain/loss alongside the
// live current value from computeHoldingValue. personal_asset and
// fixed_income are deliberately excluded: their "value" is either directly
// user-entered (no separate cost basis to compare against) or an accrual
// toward principal, not a market gain/loss.
function costBasisEGP(h: StoredHolding): number | null {
  switch (h.type) {
    case "gold":
    case "silver":
      return (Number(h.grams) || 0) * (Number(h.purchasePricePerGram) || 0);
    case "stock":
      return (Number(h.shares) || 0) * (Number(h.purchasePricePerShare) || 0);
    case "real_estate":
      return Number(h.purchasePrice) || 0;
    default:
      return null;
  }
}

function summarizeHoldings(
  holdings: StoredHolding[],
  goldUsd: number,
  silverUsd: number,
  usdToEgp: number,
  egxPrices: Record<string, number>,
): string {
  if (holdings.length === 0) return "No investment holdings recorded.";
  const lines = holdings.map((h) => {
    const currentValue = computeHoldingValue(h, goldUsd, silverUsd, usdToEgp, egxPrices);
    const cost = costBasisEGP(h);
    const gainLoss =
      cost !== null && cost > 0
        ? ` — current value ${currentValue.toFixed(0)} EGP (${currentValue >= cost ? "+" : ""}${(((currentValue - cost) / cost) * 100).toFixed(1)}% vs cost basis ${cost.toFixed(0)} EGP)`
        : ` — current value ${currentValue.toFixed(0)} EGP`;

    switch (h.type) {
      case "gold":
        return `- Gold: ${h.grams}g (${h.karat}, ${h.form}), bought at ${h.purchasePricePerGram} EGP/g${gainLoss}`;
      case "silver":
        return `- Silver: ${h.grams}g (${h.form}), bought at ${h.purchasePricePerGram} EGP/g${gainLoss}`;
      case "stock":
        return `- Stock: ${h.shares} shares of ${h.symbol} (${h.companyName}), bought at ${h.purchasePricePerShare} EGP/share${gainLoss}`;
      case "real_estate":
        return `- Real estate: ${h.propertyName} (${h.propertyType}) in ${h.district}, ${h.city}, ${h.governorate}, ${h.area}m², purchased for ${h.purchasePrice} EGP${gainLoss}`;
      case "personal_asset":
        return `- Personal asset: ${h.name} (${h.category}), current value ${h.currentValue} ${h.currency}`;
      case "fixed_income":
        return `- Fixed income: ${h.label} at ${h.institution} (${h.subtype}), principal ${h.principal} EGP at ${h.annualRate}% annual rate, matures ${h.maturityDate}, accrued value ${currentValue.toFixed(0)} EGP`;
      default:
        return `- ${h.type} holding${gainLoss}`;
    }
  });
  return `Holdings (with live current value):\n${lines.join("\n")}`;
}

function summarizeCash(accounts: DecodedRow[]): string {
  if (accounts.length === 0) return "No cash accounts recorded.";
  const lines = accounts.map((a) => `- ${a.accountName} (${a.type}): ${a.balance} ${a.currency}`);
  return `Cash accounts:\n${lines.join("\n")}`;
}

function summarizeGoals(goals: Record<string, unknown>[]): string {
  if (goals.length === 0) return "No savings goals set.";
  const lines = goals.map(
    (g) => `- ${g.name}: ${g.savedAmount}/${g.targetAmount} saved${g.deadline ? ` (deadline ${g.deadline})` : ""}`,
  );
  return `Goals:\n${lines.join("\n")}`;
}

function summarizePriceAlerts(alerts: Record<string, unknown>[]): string {
  const active = alerts.filter((a) => !a.triggered);
  if (active.length === 0) return "No active price alerts set.";
  const lines = active.map(
    (a) => `- ${a.assetLabel}: alert when price goes ${a.direction} ${a.targetPrice}`,
  );
  return `Active price alerts:\n${lines.join("\n")}`;
}

function summarizeRecurringIncome(entries: Record<string, unknown>[]): string {
  const active = entries.filter((e) => e.active);
  if (active.length === 0) return "No recurring income entries set up.";
  const lines = active.map(
    (e) => `- ${e.name}: ${e.amount} ${e.currency}/month, credited on day ${e.creditDay} of each month`,
  );
  return `Recurring income:\n${lines.join("\n")}`;
}

// Top movers across the whole EGX, not just what the user holds — already
// fetched for per-holding pricing above, so this is free (no extra call).
function summarizeEgxMovers(stocks: EGXStockResponse[]): string {
  if (stocks.length === 0) return "EGX market data unavailable right now.";
  const sorted = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sorted.slice(0, 5).map((s) => `${s.symbol} (${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(1)}%)`);
  const losers = sorted.slice(-5).reverse().map((s) => `${s.symbol} (${s.changePercent.toFixed(1)}%)`);
  return `EGX market today (${stocks.length} stocks tracked) — top gainers: ${gainers.join(", ")}. Top losers: ${losers.join(", ")}.`;
}

// Full curated per-area dataset, not just areas the user owns property in —
// lets the assistant answer general "what's the going rate in X" questions.
function summarizeRealEstateMarket(): string {
  const lines = RE_PRICES.map(
    (a) => `${a.area}, ${a.governorate}: ~${a.avgPricePerM2.toLocaleString()} EGP/m² (${a.trend}, ${a.changePercent >= 0 ? "+" : ""}${a.changePercent}% YoY)`,
  );
  return `Egypt real estate price guide (EGP per m², curated averages):\n${lines.join("\n")}`;
}

// Finds the snapshot closest to `daysAgo` days before today and describes
// the % move from it to the latest value — gives the assistant a trend to
// talk about instead of just a single point-in-time total.
function summarizeTrend(
  snapshots: { date: string; totalValue: number }[],
  latestValue: number,
  daysAgo: number,
  label: string,
): string | null {
  if (snapshots.length < 2) return null;
  const targetTime = Date.now() - daysAgo * 86_400_000;
  const closest = snapshots.reduce((best, s) =>
    Math.abs(new Date(s.date).getTime() - targetTime) < Math.abs(new Date(best.date).getTime() - targetTime)
      ? s
      : best,
  );
  if (closest.totalValue <= 0) return null;
  const pctChange = ((latestValue - closest.totalValue) / closest.totalValue) * 100;
  return `${label}: ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% (from ${closest.totalValue.toFixed(0)} EGP on ${closest.date})`;
}

// Fresh on every message, not cached across turns — cheap enough (a handful
// of small queries plus the already-cached market data fetches) that
// staleness isn't worth the complexity of invalidating a cache when the
// user edits a holding mid-conversation.
async function buildPortfolioContext(userId: string): Promise<string> {
  const [holdingRows, cashRows, goalRows, alertRows, incomeRows, snapshotRows, prices, egxStocks, inflation] =
    await Promise.all([
      db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
      db.select().from(cashAccountsTable).where(eq(cashAccountsTable.userId, userId)),
      db.select().from(goalsTable).where(eq(goalsTable.userId, userId)),
      db.select().from(priceAlertsTable).where(eq(priceAlertsTable.userId, userId)),
      db.select().from(recurringIncomeTable).where(eq(recurringIncomeTable.userId, userId)),
      db
        .select({ totalValue: portfolioSnapshotsTable.totalValue, date: portfolioSnapshotsTable.date })
        .from(portfolioSnapshotsTable)
        .where(eq(portfolioSnapshotsTable.userId, userId))
        .orderBy(asc(portfolioSnapshotsTable.date)),
      fetchPrices(),
      fetchStocks().catch(() => []),
      fetchInflation(),
    ]);

  const holdings = holdingRows.map(
    (r) => ({ id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object) }) as StoredHolding,
  );
  const cash = cashRows.map((r) => ({ type: r.type, ...(decryptFromStorage(r.data) as object) }));
  const goals = goalRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);
  const alerts = alertRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);
  const income = incomeRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  const latestSnapshot = snapshotRows[snapshotRows.length - 1];
  const latestValue = latestSnapshot?.totalValue ?? 0;
  const trends = [
    summarizeTrend(snapshotRows, latestValue, 7, "7-day change"),
    summarizeTrend(snapshotRows, latestValue, 30, "30-day change"),
  ].filter((t): t is string => t !== null);

  return [
    latestSnapshot
      ? `Total portfolio value (as of ${latestSnapshot.date}): ${latestSnapshot.totalValue} EGP.${trends.length ? ` ${trends.join("; ")}.` : ""}`
      : "No portfolio value history yet.",
    summarizeHoldings(holdings, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices),
    summarizeCash(cash),
    summarizeGoals(goals),
    summarizePriceAlerts(alerts),
    summarizeRecurringIncome(income),
    `Egypt annual inflation rate: ${inflation.rate}% (${inflation.year}, World Bank/CAPMAS CPI data).`,
    summarizeEgxMovers(egxStocks),
    summarizeRealEstateMarket(),
  ].join("\n\n");
}

const SYSTEM_PREAMBLE = `You are the INVESTRY AI Financial Assistant, built into the INVESTRY portfolio-tracking app. You help the user understand their own portfolio and general investing/personal-finance concepts.

INVESTRY tracks: investment holdings (gold, silver, EGX stocks, real estate, personal assets, fixed income), cash accounts, savings goals, recurring income, and custom price alerts. The data below reflects live current market values (gold/silver spot prices and EGX stock prices), not just what the user originally paid — use it to answer questions about current value and unrealized gain/loss directly, not just historical cost.

Beyond the user's own data, you also have: Egypt's current annual inflation rate, today's EGX market movers (top gainers/losers across the whole exchange, not just what the user holds), and a curated Egypt-wide real estate price-per-m² guide covering dozens of areas — so you can answer general market questions (e.g. "what's the going rate in Sheikh Zayed", "is EGX up today", "how does my return compare to inflation") even about things the user doesn't personally own.

Rules:
- You are not a licensed financial advisor. Never recommend a specific trade, a specific security to buy or sell, or a specific allocation change as advice — explain tradeoffs and considerations instead, and let the user decide.
- Ground your answers in the data provided below when the question relates to it — it includes live pricing and broad market context, so don't claim you lack live data for anything covered there. Only say you lack data for things genuinely outside this snapshot (breaking news, assets/areas not covered here, markets outside EGX/gold/silver/Egypt real estate).
- Be concise and direct — this is a mobile chat, not a report.
- If asked for something that would cross into specific financial advice, say so plainly and explain why, then offer general education on the topic instead.`;

// Gemini's free tier is scoped to our own API key/project — unlike
// OpenRouter's shared ":free" pool, other apps' traffic can't exhaust it
// out from under us. gemini-3.5-flash-lite is Google's fastest, cheapest
// tier and isn't a reasoning model, so there's no hidden chain-of-thought
// tax on latency.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

type ChatTurn = { role: "user" | "assistant"; content: string };

async function callGemini(systemPrompt: string, messages: ChatTurn[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 1024 },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

// POST /api/chat — a single grounded turn, not a persisted conversation.
// The client resends full message history each call (stateless); nothing
// is stored server-side.
router.post("/chat", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (!process.env.GEMINI_API_KEY) { res.status(503).json({ error: "AI Assistant is not available right now" }); return; }

  const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const isPro = user?.plan === "pro" || process.env.BETA_UNLOCK_ALL === "true";
  if (!isPro) { res.status(403).json({ error: "AI Assistant is a Pro feature" }); return; }

  const body = req.body as { messages?: ChatTurn[] };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    res.status(400).json({ error: "messages must be a non-empty array ending with a user message" });
    return;
  }

  try {
    const portfolioContext = await buildPortfolioContext(userId);
    const systemPrompt = `${SYSTEM_PREAMBLE}\n\nHere is the user's current portfolio:\n\n${portfolioContext}`;
    const reply = await callGemini(systemPrompt, messages);
    res.json({ reply: reply || "I couldn't come up with a response — try rephrasing your question." });
  } catch (err) {
    req.log.error({ err }, "POST /chat failed");
    res.status(500).json({ error: "Failed to get a response from the assistant" });
  }
});

export default router;
