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
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { decryptFromStorage } from "../lib/encryption";

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

function summarizeHoldings(holdings: DecodedRow[]): string {
  if (holdings.length === 0) return "No investment holdings recorded.";
  const lines = holdings.map((h) => {
    switch (h.type) {
      case "gold":
        return `- Gold: ${h.grams}g (${h.karat}, ${h.form}), bought at ${h.purchasePricePerGram} EGP/g`;
      case "silver":
        return `- Silver: ${h.grams}g (${h.form}), bought at ${h.purchasePricePerGram} EGP/g`;
      case "stock":
        return `- Stock: ${h.shares} shares of ${h.symbol} (${h.companyName}), bought at ${h.purchasePricePerShare} EGP/share`;
      case "real_estate":
        return `- Real estate: ${h.propertyName} (${h.propertyType}) in ${h.district}, ${h.city}, ${h.governorate}, ${h.area}m², purchased for ${h.purchasePrice} EGP`;
      case "personal_asset":
        return `- Personal asset: ${h.name} (${h.category}), current value ${h.currentValue} ${h.currency}`;
      case "fixed_income":
        return `- Fixed income: ${h.label} at ${h.institution} (${h.subtype}), principal ${h.principal} EGP at ${h.annualRate}% annual rate, matures ${h.maturityDate}`;
      default:
        return `- ${h.type} holding`;
    }
  });
  return `Holdings:\n${lines.join("\n")}`;
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

// Fresh on every message, not cached across turns — cheap enough (a handful
// of small queries) that staleness isn't worth the complexity of invalidating
// a cache when the user edits a holding mid-conversation.
async function buildPortfolioContext(userId: string): Promise<string> {
  const [holdingRows, cashRows, goalRows, snapshotRows] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(cashAccountsTable).where(eq(cashAccountsTable.userId, userId)),
    db.select().from(goalsTable).where(eq(goalsTable.userId, userId)),
    db
      .select({ totalValue: portfolioSnapshotsTable.totalValue, date: portfolioSnapshotsTable.date })
      .from(portfolioSnapshotsTable)
      .where(eq(portfolioSnapshotsTable.userId, userId))
      .orderBy(desc(portfolioSnapshotsTable.date))
      .limit(1),
  ]);

  const holdings = holdingRows.map((r) => ({ type: r.type, ...(decryptFromStorage(r.data) as object) }));
  const cash = cashRows.map((r) => ({ type: r.type, ...(decryptFromStorage(r.data) as object) }));
  const goals = goalRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);
  const latestSnapshot = snapshotRows[0];

  return [
    latestSnapshot
      ? `Total portfolio value (as of ${latestSnapshot.date}): ${latestSnapshot.totalValue} EGP.`
      : "No portfolio value history yet.",
    summarizeHoldings(holdings),
    summarizeCash(cash),
    summarizeGoals(goals),
  ].join("\n\n");
}

const SYSTEM_PREAMBLE = `You are the INVESTRY AI Financial Assistant, built into the INVESTRY portfolio-tracking app. You help the user understand their own portfolio and general investing/personal-finance concepts.

Rules:
- You are not a licensed financial advisor. Never recommend a specific trade, a specific security to buy or sell, or a specific allocation change as advice — explain tradeoffs and considerations instead, and let the user decide.
- Ground your answers in the portfolio data provided below when the question relates to it. If asked about something not in this data (live prices, breaking news, anything outside this snapshot), say plainly that you don't have that live data rather than guessing.
- Be concise and direct — this is a mobile chat, not a report.
- If asked for something that would cross into specific financial advice, say so plainly and explain why, then offer general education on the topic instead.`;

// OpenRouter's free tier — no billing setup required, but capped at 50
// requests/day *across the whole app* (not per user) until $10+ in credit
// has ever been added to the account, then 1000/day. If the assistant
// starts erroring for everyone around the same time each day, this daily
// cap is almost certainly why.
const OPENROUTER_MODEL = "openai/gpt-oss-20b:free";

type ChatTurn = { role: "user" | "assistant"; content: string };

async function callOpenRouter(systemPrompt: string, messages: ChatTurn[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// POST /api/chat — a single grounded turn, not a persisted conversation.
// The client resends full message history each call (stateless); nothing
// is stored server-side.
router.post("/chat", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (!process.env.OPENROUTER_API_KEY) { res.status(503).json({ error: "AI Assistant is not available right now" }); return; }

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
    const reply = await callOpenRouter(systemPrompt, messages);
    res.json({ reply: reply || "I couldn't come up with a response — try rephrasing your question." });
  } catch (err) {
    req.log.error({ err }, "POST /chat failed");
    res.status(500).json({ error: "Failed to get a response from the assistant" });
  }
});

export default router;
