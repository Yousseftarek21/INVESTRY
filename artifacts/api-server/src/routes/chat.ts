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
  chatMessagesTable,
  realEstatePricesTable,
} from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import { encryptForStorage, decryptFromStorage } from "../lib/encryption";
import {
  getCachedPrices, getCachedStocks, getCachedGlobalStocks, getCachedStockNews,
  type EGXStockResponse, type StockNewsItem, type MarketPricesResponse,
} from "./markets";
import { computeHoldingValue, type StoredHolding } from "../lib/portfolioValue";
import { fetchInflation } from "./inflation";
import { RE_PRICES } from "@workspace/shared-data";

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
// Applied only to the POST route below, not GET /chat/history — loading
// past messages doesn't call Gemini and shouldn't eat into that budget.
const chatGenerationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId ?? "anonymous",
});

function generateChatMessageId(): string {
  return `chm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

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

// Same per-currency conversion as computeUserPortfolioAllocation in
// portfolioValue.ts (USD via the dedicated usdToEgp field, everything else
// via fxRates, unknown currencies falling back to face value) — duplicated
// here as a small pure function rather than imported, since that function
// does its own DB fetches and buildPortfolioContext below already has
// holdings/cash/prices in scope from its own single Promise.all.
function toEGP(amount: number, currency: string | undefined, prices: MarketPricesResponse): number {
  if (!currency || currency === "EGP") return amount;
  if (currency === "USD" && prices.usdToEgp) return amount * prices.usdToEgp;
  const rate = prices.fxRates?.[currency];
  return rate ? amount * rate : amount;
}

function summarizeCash(accounts: DecodedRow[]): string {
  if (accounts.length === 0) return "No cash accounts recorded.";
  const lines = accounts.map((a) => `- ${a.accountName} (${a.type}): ${a.balance} ${a.currency}`);
  return `Cash accounts:\n${lines.join("\n")}`;
}

// Mirrors artifacts/mobile/app/goals.tsx's effectiveSaved(): a goal linked to
// a cash account tracks that account's live balance instead of its own
// stored savedAmount, which is only a last-known snapshot from whenever the
// goal was last saved. Reading savedAmount directly (as this used to) gave
// the assistant a stale number whenever the account's balance had moved
// since — falls back to the stored snapshot if the linked account is gone.
function effectiveSaved(g: Record<string, unknown>, cash: DecodedRow[]): number {
  const linkedId = g.linkedCashAccountId as string | undefined;
  if (!linkedId) return Number(g.savedAmount) || 0;
  const account = cash.find((a) => a.id === linkedId);
  return account ? Number(account.balance) || 0 : Number(g.savedAmount) || 0;
}

function summarizeGoals(goals: Record<string, unknown>[], cash: DecodedRow[]): string {
  if (goals.length === 0) return "No savings goals set.";
  const lines = goals.map((g) => {
    const saved = effectiveSaved(g, cash);
    return `- ${g.name}: ${saved}/${g.targetAmount} saved${g.deadline ? ` (deadline ${g.deadline})` : ""}`;
  });
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

// entries are a mix of two shapes (RecurringIncome's IncomeKind, see
// types/index.ts in the mobile app): 'recurring' (the only kind that
// existed before pending was added — missing `kind` on an old record means
// 'recurring') is a fixed monthly credit into a cash account; 'pending' is
// a one-off receivable with no schedule, counted toward the user's net
// worth immediately and until marked collected. Previously this function
// treated every entry as a recurring monthly credit regardless of kind —
// a pending entry (no creditDay at all) rendered as "credited on day
// undefined of each month", and nothing here ever told the assistant
// pending income counts toward net worth, which is exactly the wrong
// answer a real user got asking about it.
function summarizeRecurringIncome(entries: Record<string, unknown>[]): string {
  const recurring = entries.filter((e) => (e.kind ?? "recurring") === "recurring" && e.active);
  const pending = entries.filter((e) => e.kind === "pending");
  if (recurring.length === 0 && pending.length === 0) return "No recurring or pending income entries set up.";

  const parts: string[] = [];
  if (recurring.length > 0) {
    const lines = recurring.map(
      (e) => `- ${e.name}: ${e.amount} ${e.currency}/month, credited on day ${e.creditDay} of each month`,
    );
    parts.push(`Recurring income (fixed monthly credit into a cash account):\n${lines.join("\n")}`);
  }
  if (pending.length > 0) {
    const lines = pending.map((e) => {
      const status = e.collected
        ? "collected — already deposited, no longer counted toward net worth separately (it's now part of the destination cash account's balance)"
        : "NOT yet collected — counted toward net worth right now as a receivable";
      const expected = e.expectedDate ? `, expected ${e.expectedDate}` : "";
      return `- ${e.name}: ${e.amount} ${e.currency}${expected} — ${status}`;
    });
    parts.push(
      `Pending income (one-off receivables — money owed to the user, not yet in any cash account):\n${lines.join("\n")}\n` +
      `Rule: an uncollected pending entry counts toward the user's net worth immediately, exactly like a cash balance — it stops being counted separately the moment it's marked collected, since its amount is then already reflected in the destination cash account.`,
    );
  }
  return parts.join("\n\n");
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

// Unconditional, like summarizeEgxMovers above — previously this only
// reached the assistant indirectly, inside a gold/silver holding's own line
// in summarizeHoldings. A user with no metal holdings asking "what's the
// gold price today" had nothing to ground an answer in at all. Same fetch
// already happening for holding valuation, so this is free.
function summarizeMetals(prices: MarketPricesResponse): string {
  const goldLine = Object.entries(prices.goldEgpPerGram)
    .map(([karat, egp]) => `${karat}: ${egp.toLocaleString()} EGP/g`)
    .join(", ");
  return [
    `Gold spot: ${prices.goldUsd.toFixed(2)} USD/oz (${prices.goldChangePercent >= 0 ? "+" : ""}${prices.goldChangePercent.toFixed(2)}% today). Egypt gold by purity — ${goldLine}.`,
    `Silver spot: ${prices.silverUsd.toFixed(2)} USD/oz (${prices.silverChangePercent >= 0 ? "+" : ""}${prices.silverChangePercent.toFixed(2)}% today). Egypt: ${prices.silverEgpPerGram.toLocaleString()} EGP/g.`,
    `USD/EGP: ${prices.usdToEgp.toFixed(2)} (${prices.usdToEgpChangePercent >= 0 ? "+" : ""}${prices.usdToEgpChangePercent.toFixed(2)}% today).`,
  ].join(" ");
}

// Full dataset, not just areas the user owns property in — lets the
// assistant answer general "what's the going rate in X" questions. Prefers
// live-scraped Property Finder averages (real_estate_prices, refreshed
// twice a day by realEstatePriceCron.ts) per area.
//
// Only scraped areas are listed. The curated RE_PRICES figures this used to
// fall back on measured ~4x below real listing prices, and stating them to
// the assistant as fact meant it quoted them confidently to users — the
// worst possible place for a wrong number. Areas without a scrape are named
// as unknown so the assistant can say it doesn't know rather than guess.
async function summarizeRealEstateMarket(): Promise<string> {
  const rows = await db.select().from(realEstatePricesTable);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const known: string[] = [];
  const unknown: string[] = [];
  for (const a of RE_PRICES) {
    const scraped = byId.get(a.id);
    if (!scraped) { unknown.push(a.area); continue; }
    const changeTxt = scraped.changePercent != null
      ? `${scraped.changePercent >= 0 ? "+" : ""}${scraped.changePercent.toFixed(1)}% since last check`
      : "no trend yet";
    known.push(`${a.area}, ${a.governorate}: ~${scraped.avgPricePerM2.toLocaleString()} EGP/m² (live, ${scraped.sampleSize} listings, ${changeTxt})`);
  }

  // Real estate is explicitly a beta feature in the product right now (see
  // the "Beta" badge on the Real Estate section itself) — the assistant
  // should say so plainly whenever real estate comes up, not just when data
  // happens to be missing for a given area. Coverage is real but partial,
  // and framing it as beta is more honest than answering as if it were as
  // complete as the EGX/metals coverage above.
  const betaNote = "\n\nNote: INVESTRY's real estate tracking is still in beta testing — coverage is limited to the areas listed above, and figures are directional averages, not appraisals. Say this plainly whenever real estate comes up in the conversation.";

  if (known.length === 0) {
    return `Egypt real estate: no live price data available right now. Say you don't have current figures rather than estimating.${betaNote}`;
  }
  const unknownNote = unknown.length
    ? `\n\nNo current data for these areas — say so plainly if asked, do not estimate: ${unknown.join(", ")}`
    : "";
  return `Egypt real estate price guide (EGP per m², live scraped data only):\n${known.join("\n")}${unknownNote}${betaNote}`;
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
async function buildPortfolioContext(
  userId: string,
): Promise<{ context: string; egxStocks: EGXStockResponse[]; globalStocks: EGXStockResponse[] }> {
  const [holdingRows, cashRows, goalRows, alertRows, incomeRows, snapshotRows, prices, egxStocks, globalStocks, inflation, realEstateSummary] =
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
      getCachedPrices(),
      getCachedStocks().catch(() => []),
      getCachedGlobalStocks().catch(() => []),
      fetchInflation(),
      summarizeRealEstateMarket(),
    ]);

  const holdings = holdingRows.map(
    (r) => ({ id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object) }) as StoredHolding,
  );
  const cash = cashRows.map((r) => ({ id: r.id, type: r.type, ...(decryptFromStorage(r.data) as object) }));
  const goals = goalRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);
  const alerts = alertRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);
  const income = incomeRows.map((r) => decryptFromStorage(r.data) as Record<string, unknown>);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  // portfolio_snapshots.totalValue (written by portfolioAlertCron, via
  // computeUserPortfolioValue) is holdings ONLY — it has never included
  // cash or pending income, so it's kept below purely as the source for a
  // historical trend line, clearly labeled as such, not conflated with net
  // worth. The actual net-worth figure the assistant should quote is
  // computed fresh right here instead, from data already fetched above —
  // this is what was missing before: nothing ever added cash + uncollected
  // pending income into a single number, so the assistant had no correct
  // total to reference at all, only three separate lines it would have had
  // to add up itself.
  const holdingsValueEGP = holdings.reduce(
    (sum, h) => sum + computeHoldingValue(h, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices),
    0,
  );
  const cashValueEGP = cash.reduce(
    (sum, a) => sum + toEGP(Number((a as { balance?: number }).balance) || 0, (a as { currency?: string }).currency, prices),
    0,
  );
  const pendingIncomeEGP = income
    .filter((e) => e.kind === "pending" && !e.collected)
    .reduce((sum, e) => sum + toEGP(Number(e.amount) || 0, e.currency as string | undefined, prices), 0);
  const netWorthEGP = holdingsValueEGP + cashValueEGP + pendingIncomeEGP;

  const latestSnapshot = snapshotRows[snapshotRows.length - 1];
  const latestValue = latestSnapshot?.totalValue ?? 0;
  const trends = [
    summarizeTrend(snapshotRows, latestValue, 7, "7-day change"),
    summarizeTrend(snapshotRows, latestValue, 30, "30-day change"),
  ].filter((t): t is string => t !== null);

  const context = [
    `Net worth right now (investment holdings + cash + uncollected pending income): ${netWorthEGP.toFixed(0)} EGP. ` +
      `Breakdown — investment holdings: ${holdingsValueEGP.toFixed(0)} EGP, cash accounts: ${cashValueEGP.toFixed(0)} EGP, uncollected pending income: ${pendingIncomeEGP.toFixed(0)} EGP. ` +
      `This is the correct total for "net worth" or "how much am I worth" — always include all three parts, not just holdings.`,
    latestSnapshot
      ? `Investment holdings value trend (holdings only, NOT net worth — as of ${latestSnapshot.date}): ${latestSnapshot.totalValue} EGP.${trends.length ? ` ${trends.join("; ")}.` : ""}`
      : "No holdings-value history yet.",
    summarizeHoldings(holdings, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices),
    summarizeCash(cash),
    summarizeGoals(goals, cash),
    summarizePriceAlerts(alerts),
    summarizeRecurringIncome(income),
    `Egypt annual inflation rate: ${inflation.rate}% (${inflation.year}, World Bank/CAPMAS CPI data).`,
    summarizeMetals(prices),
    summarizeEgxMovers(egxStocks),
    realEstateSummary,
  ].join("\n\n");

  return { context, egxStocks, globalStocks };
}

const SYSTEM_PREAMBLE = `You are the INVESTRY AI Financial Assistant, built into the INVESTRY portfolio-tracking app. You help the user understand their own portfolio and general investing/personal-finance concepts.

INVESTRY tracks: investment holdings (gold, silver, EGX stocks, real estate, personal assets, fixed income), cash accounts, savings goals, recurring income (fixed monthly credits) and pending income (one-off receivables — money owed to the user, not yet collected), and custom price alerts. The data below reflects live current market values (gold/silver spot prices and EGX stock prices), not just what the user originally paid — use it to answer questions about current value and unrealized gain/loss directly, not just historical cost.

Net worth = investment holdings + cash accounts + uncollected pending income. A pre-computed, correct total for this is given to you directly below (labeled "Net worth right now") — always use that figure and its breakdown when asked about net worth or "how much am I worth," don't try to add up holdings/cash/pending yourself from their separate sections, and never say pending income isn't counted — it is, until the moment it's marked collected.

Beyond the user's own data, you also have: Egypt's current annual inflation rate, today's EGX market movers (top gainers/losers across the whole exchange, not just what the user holds), and a curated Egypt-wide real estate price-per-m² guide covering dozens of areas — so you can answer general market questions (e.g. "what's the going rate in Sheikh Zayed", "is EGX up today", "how does my return compare to inflation") even about things the user doesn't personally own.

You also have three tools, and should use them freely for ANY stock the user asks about, whether they own it or not — don't limit yourself to what's already summarized above:
- lookup_egx_company: full fundamentals for any EGX-listed company — price, P/E, dividend yield, price/book, sector, EPS, revenue growth, net margin, ROE, debt/equity, current ratio, quick ratio, return on assets, free cash flow, cash & equivalents, employee count, market cap, 52-week range. Use it whenever asked about a specific EGX company's fundamentals, financial health, or for an analysis of one — this is real, live, comprehensive data, not a guess.
- lookup_global_stock: live price and today's change for a non-EGX ticker (e.g. AAPL, TSLA).
- get_egx_stock_news: recent real news headlines and regulatory disclosures for a specific EGX company — use it whenever asked what's going on with a company, why a stock moved, or for recent news.

When asked to "analyze" a stock or for your "take" on one, use these tools and give a genuine, thorough qualitative analysis — valuation, profitability, leverage, liquidity, recent news, how it compares to the sector — don't hedge into vagueness or refuse just because it's outside the user's holdings. The one hard line is the rules below: describe and explain, never issue a specific buy/sell/allocate instruction.

Rules:
- You are not a licensed financial advisor. Never recommend a specific trade, a specific security to buy or sell, or a specific allocation change as advice — explain tradeoffs and considerations instead, and let the user decide. This applies to analysis depth, not analysis existence: go deep on the data and the reasoning, just stop short of the directive "buy/sell/hold this."
- Ground your answers in the data provided below and from your tools when the question relates to it — it includes live pricing and broad market context, so don't claim you lack live data for anything covered there or reachable via a tool. Only say you lack data for things genuinely outside this snapshot and these tools (breaking news outside what get_egx_stock_news returns, assets/areas not covered here, markets outside EGX/US-tickers/gold/silver/Egypt real estate).
- Be concise and direct — this is a mobile chat, not a report — but don't cut a genuine analysis short just to be brief; thoroughness matters more than length when the user explicitly asked for analysis.
- If asked for something that would cross into specific financial advice, say so plainly and explain why, then offer general education on the topic instead.`;

// Gemini's free tier is scoped to our own API key/project — unlike
// OpenRouter's shared ":free" pool, other apps' traffic can't exhaust it
// out from under us. gemini-3.5-flash-lite is Google's fastest, cheapest
// tier and isn't a reasoning model, so there's no hidden chain-of-thought
// tax on latency.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

type ChatTurn = { role: "user" | "assistant"; content: string };

// Script alone isn't the same thing as language: a huge share of Egyptian
// texting is Arabic written in Latin letters ("Ezayak", "3ezayak") \u2014 an
// earlier version of this treated "has Latin letters" as "is English",
// which forced an English reply to that and even overrode an explicit
// "Talk Arabic" request typed in Latin script (see git history). Order
// matters here: an explicit short request to switch language wins first,
// in either script; then real Arabic script; then confidently long Latin
// prose (a real question, not a one-word greeting); and only genuinely
// short/ambiguous Latin content (a greeting, a bare number, "ok") falls
// back to the app's own toggle \u2014 which is exactly the case Arabizi lands
// in, so it resolves correctly without needing to actually parse Arabizi.
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ENGLISH_REQUEST_RE = /\benglish\b|\u0627\u0646\u062C\u0644\u064A\u0632[\u064A\u0649]|\u0625\u0646\u062C\u0644\u064A\u0632[\u064A\u0649]/i;
const ARABIC_REQUEST_RE = /\barabic\b|\u0628\u0627\u0644\u0639\u0631\u0628|\u0639\u0631\u0628[\u064A\u0649]/i;
const SUBSTANTIAL_LATIN_LENGTH = 20;
function detectReplyLanguage(latestMessage: string, appLanguage: "ar" | "en"): "ar" | "en" {
  const trimmed = latestMessage.trim();
  // Length-guarded so a genuine longer question that happens to mention
  // "Arabic"/"English" as a topic isn't misread as a request to switch.
  if (trimmed.length <= 40) {
    if (ENGLISH_REQUEST_RE.test(trimmed)) return "en";
    if (ARABIC_REQUEST_RE.test(trimmed)) return "ar";
  }
  if (ARABIC_SCRIPT_RE.test(trimmed)) return "ar";
  if (trimmed.length > SUBSTANTIAL_LATIN_LENGTH) return "en";
  return appLanguage;
}

// Only the user's own holdings are inlined into every message (small,
// always relevant). The other ~280+ EGX companies are reachable on demand
// through this tool instead of being dumped into context every turn, which
// would waste most of the free tier's token budget on companies that
// aren't relevant to a given question.
const LOOKUP_TOOL = {
  functionDeclarations: [
    {
      name: "lookup_egx_company",
      description:
        "Look up live price and full fundamentals (P/E, dividend yield, price/book, sector, EPS, " +
        "revenue growth, net margin, ROE, debt/equity, current ratio, quick ratio, return on assets, " +
        "free cash flow, cash & equivalents, employee count, market cap, 52-week range) for any " +
        "company listed on the Egyptian Exchange (EGX) — not just ones the user owns. Use this " +
        "whenever asked about a specific EGX company's fundamentals, financial health, or for an " +
        "analysis of a stock the user doesn't hold.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The EGX ticker symbol or company name (or part of it) to search for.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "lookup_global_stock",
      description:
        "Look up live price and change for a non-EGX (US/international) stock by ticker, e.g. AAPL, " +
        "TSLA, MSFT. Use this when asked about a company outside the Egyptian Exchange.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol, e.g. AAPL.",
          },
        },
        required: ["symbol"],
      },
    },
    {
      name: "get_egx_stock_news",
      description:
        "Get recent real news headlines and regulatory disclosures (Reuters, exchange filings, " +
        "earnings releases) for a specific EGX-listed company. Use this when asked what's going on " +
        "with a company, why a stock moved, or for recent news/announcements about it.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The EGX ticker symbol, e.g. COMI.",
          },
        },
        required: ["symbol"],
      },
    },
  ],
};

function lookupEgxCompany(query: string, stocks: EGXStockResponse[]): string {
  const q = query.trim().toUpperCase();
  const bySymbol = stocks.filter((s) => s.symbol.toUpperCase() === q);
  const matches = bySymbol.length > 0
    ? bySymbol
    : stocks.filter((s) => s.name.toUpperCase().includes(q) || s.symbol.toUpperCase().includes(q));

  if (matches.length === 0) return `No EGX company found matching "${query}".`;

  return matches.slice(0, 5).map((s) => [
    `${s.name} (${s.symbol}): price ${s.price} EGP (${s.changePercent >= 0 ? "+" : ""}${s.changePercent}% today)`,
    s.sector ? `sector: ${s.sector}` : null,
    s.pe != null ? `P/E: ${s.pe}` : "P/E: n/a",
    s.dividendYield != null ? `dividend yield: ${s.dividendYield}%` : "dividend yield: n/a",
    s.priceToBook != null ? `price/book: ${s.priceToBook}` : null,
    s.epsTtm != null ? `EPS (TTM): ${s.epsTtm}` : null,
    s.revenueGrowthYoy != null ? `revenue growth YoY: ${s.revenueGrowthYoy}%` : null,
    s.netMargin != null ? `net margin: ${s.netMargin}%` : null,
    s.roe != null ? `ROE: ${s.roe}%` : null,
    s.debtToEquity != null ? `debt/equity: ${s.debtToEquity}` : null,
    s.currentRatio != null ? `current ratio: ${s.currentRatio}` : null,
    s.quickRatio != null ? `quick ratio: ${s.quickRatio}` : null,
    s.returnOnAssets != null ? `return on assets: ${s.returnOnAssets}%` : null,
    s.freeCashFlowTtm != null ? `free cash flow (TTM): ${s.freeCashFlowTtm.toLocaleString()} EGP` : null,
    s.cashAndEquivalents != null ? `cash & equivalents: ${s.cashAndEquivalents.toLocaleString()} EGP` : null,
    s.employees != null ? `employees: ${s.employees.toLocaleString()}` : null,
    s.marketCap != null ? `market cap: ${s.marketCap.toLocaleString()} EGP` : null,
    s.high52w != null && s.low52w != null ? `52-week range: ${s.low52w}–${s.high52w} EGP` : null,
  ].filter(Boolean).join(", ")).join("\n");
}

function lookupGlobalStock(symbol: string, stocks: EGXStockResponse[]): string {
  const q = symbol.trim().toUpperCase();
  const match = stocks.find((s) => s.symbol.toUpperCase() === q);
  if (!match) return `No live data found for global ticker "${symbol}".`;
  return `${match.name} (${match.symbol}): price ${match.price} (${match.changePercent >= 0 ? "+" : ""}${match.changePercent}% today).`;
}

async function getEgxStockNews(symbol: string): Promise<string> {
  const q = symbol.trim().toUpperCase();
  const items: StockNewsItem[] = await getCachedStockNews(q).catch(() => []);
  if (items.length === 0) return `No recent news found for ${q}.`;
  return items.slice(0, 8)
    .map((n) => `- [${new Date(n.publishedAt * 1000).toISOString().slice(0, 10)}] ${n.title} (${n.source})`)
    .join("\n");
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; id?: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; id?: string; response: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

// Bumped from 3: a thorough "analyze this stock" question now realistically
// calls lookup_egx_company AND get_egx_stock_news in the same turn before
// producing final text, and needs headroom for both plus a follow-up call.
const MAX_TOOL_ROUNDS = 5;

// Reverted from a streamed (SSE) implementation — it shipped broken (every
// reply fell straight to the "couldn't come up with a response" fallback,
// confirmed by production logs, likely a parsing mismatch against Gemini's
// actual streamGenerateContent chunk shape). A working synchronous call
// beats a broken streaming one; re-attempt streaming later with a way to
// verify it against a real response before shipping again.
async function callGemini(
  systemPrompt: string,
  messages: ChatTurn[],
  egxStocks: EGXStockResponse[],
  globalStocks: EGXStockResponse[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          // Raised from 1024: a genuine "analyze this stock" answer covering
          // valuation, profitability, leverage, liquidity, and recent news
          // needs more headroom than a quick portfolio-value question does.
          generationConfig: { maxOutputTokens: 2048 },
          tools: [LOOKUP_TOOL],
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const functionCallPart = parts.find(
      (p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p,
    );

    if (!functionCallPart) {
      return parts
        .map((p) => ("text" in p ? p.text : ""))
        .join("")
        .trim();
    }

    const { name, id, args } = functionCallPart.functionCall;
    let result: string;
    if (name === "lookup_egx_company") {
      result = lookupEgxCompany(String(args.query ?? ""), egxStocks);
    } else if (name === "lookup_global_stock") {
      result = lookupGlobalStock(String(args.symbol ?? ""), globalStocks);
    } else if (name === "get_egx_stock_news") {
      result = await getEgxStockNews(String(args.symbol ?? ""));
    } else {
      result = `Unknown tool: ${name}`;
    }

    contents.push({ role: "model", parts: [functionCallPart] });
    contents.push({ role: "user", parts: [{ functionResponse: { name, id, response: { result } } }] });
  }

  return "I looked into a few things but couldn't finish in time — try asking again, maybe more specifically.";
}

// Bounds both what GET /chat/history returns and, in turn, what the client
// resends on every POST /chat call — the system prompt already injects a
// sizeable portfolio context every turn, so letting the resent history grow
// unbounded would keep inflating token cost and latency the longer someone
// uses the assistant. 40 turns (20 exchanges) is generous scrollback without
// that growth.
const CHAT_HISTORY_LIMIT = 40;

// GET /api/chat/history — this user's persisted messages, oldest first, for
// the read-only History screen (the active chat screen itself always starts
// fresh — see POST /api/chat). createdAt is included so the client can group
// consecutive messages by day.
router.get("/chat/history", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select({ data: chatMessagesTable.data, createdAt: chatMessagesTable.createdAt })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, userId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(CHAT_HISTORY_LIMIT);

    const messages = rows.reverse().map((r) => ({
      ...(decryptFromStorage(r.data) as ChatTurn),
      createdAt: r.createdAt,
    }));
    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "GET /chat/history failed");
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// POST /api/chat — a single grounded turn, JSON in and out (see callGemini's
// comment for why this isn't streamed). The active conversation is always
// fresh per screen-open (the client no longer seeds itself from
// GET /chat/history); this still persists every turn so that endpoint has
// something to show in the separate history view.
router.post("/chat", chatGenerationLimit, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (!process.env.GEMINI_API_KEY) { res.status(503).json({ error: "AI Assistant is not available right now" }); return; }

  const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const isPro = user?.plan === "pro" || process.env.BETA_UNLOCK_ALL === "true";
  if (!isPro) { res.status(403).json({ error: "AI Assistant is a Pro feature" }); return; }

  const body = req.body as { messages?: ChatTurn[]; language?: string };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    res.status(400).json({ error: "messages must be a non-empty array ending with a user message" });
    return;
  }
  const latestUserMessage = messages[messages.length - 1];

  // Asking the model to detect the user's language itself and then comply
  // failed twice in practice — even an unambiguous English message like
  // "Hi" still sometimes came back in Arabic on gemini-3.5-flash-lite (see
  // git history). Detecting it deterministically in code instead removes
  // that failure mode entirely: the model is handed a fact to obey, not a
  // judgment call to make. For an English message the prompt contains zero
  // Arabic text at all, which also rules out the model drifting toward
  // Arabic script by mere proximity to Arabic-language guidance elsewhere
  // in the prompt — a real tendency independent of what that guidance
  // literally says to do.
  const appLanguage: "ar" | "en" = body.language === "ar" ? "ar" : "en";
  const replyLanguage = detectReplyLanguage(latestUserMessage.content, appLanguage);
  const languageInstruction = replyLanguage === "ar"
    ? "\n\nLANGUAGE: Write your entire reply in genuine Egyptian colloquial Arabic (مصري) — the way a Cairo finance person actually talks, not a formal or literal translation of an English sentence. " +
      "Default to everyday spoken word order and vocabulary (e.g. \"فلوسك\" not \"أموالك\", \"محفظتك زادت\" not \"لقد ارتفعت محفظتك\") — reach for Modern Standard Arabic only for genuinely formal/technical terms that don't have a natural colloquial equivalent (e.g. official fund or regulatory names), not as the default register. " +
      "Keep numbers, percentages, and currency the way Egyptians actually say them out loud (e.g. \"مليون وميتين ألف جنيه\", not a stiff digit-by-digit reading), since replies are sometimes read aloud by text-to-speech and need to sound natural spoken, not just correct written. " +
      "If a reply reads like it was translated rather than originally thought in Arabic, rewrite it before answering. " +
      "The app's name, INVESTRY, is a fixed English brand name — always write it exactly as \"INVESTRY\" in Latin letters, even mid-sentence in Arabic, never transliterated into Arabic script."
    : "\n\nLANGUAGE: Write your entire reply in English. Do not include any Arabic.";

  let portfolioContext: string;
  let egxStocks: EGXStockResponse[];
  let globalStocks: EGXStockResponse[];
  try {
    ({ context: portfolioContext, egxStocks, globalStocks } = await buildPortfolioContext(userId));
  } catch (err) {
    req.log.error({ err }, "POST /chat failed to build portfolio context");
    res.status(500).json({ error: "Failed to get a response from the assistant" });
    return;
  }
  const systemPrompt = `${SYSTEM_PREAMBLE}${languageInstruction}\n\nHere is the user's current portfolio:\n\n${portfolioContext}`;

  try {
    const reply = await callGemini(systemPrompt, messages, egxStocks, globalStocks);
    const finalReply = reply || "I couldn't come up with a response — try rephrasing your question.";
    res.json({ reply: finalReply });

    // Only the new turn — everything earlier in `messages` was already
    // persisted on a previous call. Fire-and-forget: a failed history write
    // shouldn't affect a reply the user already received.
    db.insert(chatMessagesTable)
      .values([
        { id: generateChatMessageId(), userId, data: encryptForStorage(latestUserMessage) },
        { id: generateChatMessageId(), userId, data: encryptForStorage({ role: "assistant", content: finalReply }) },
      ])
      .catch((err) => req.log.error({ err }, "Failed to persist chat turn"));
  } catch (err) {
    req.log.error({ err }, "POST /chat failed");
    res.status(500).json({ error: "Failed to get a response from the assistant" });
  }
});

export default router;
