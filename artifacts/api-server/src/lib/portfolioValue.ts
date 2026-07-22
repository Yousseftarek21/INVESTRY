import { db, holdingsTable, cashAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptFromStorage } from "./encryption";
import { fetchPrices, fetchStocks } from "../routes/markets";

const TROY_OZ_TO_GRAMS = 31.1034768;

export type GoldKarat = "24k" | "22k" | "21k" | "18k";

// Mirrors artifacts/mobile/types/index.ts's Holding union — only the fields
// actually needed for valuation are read here, everything else is opaque.
interface StoredHolding {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface StoredCashAccount {
  id: string;
  balance: number;
  [key: string]: unknown;
}

export function goldPricePerGram(goldUsd: number, usdToEgp: number, karat: GoldKarat): number {
  const perGramUsd = goldUsd / TROY_OZ_TO_GRAMS;
  const purity = karat === "24k" ? 1 : karat === "22k" ? 22 / 24 : karat === "21k" ? 0.875 : 0.75;
  return perGramUsd * purity * usdToEgp;
}

export function silverPricePerGram(silverUsd: number, usdToEgp: number): number {
  return (silverUsd / TROY_OZ_TO_GRAMS) * usdToEgp;
}

// At-maturity certificates accrue toward their principal + interest daily;
// monthly/quarterly-payout products pay interest out instead of compounding,
// so their redemption value stays flat at principal until maturity — same
// rule as artifacts/mobile/components/HoldingCard.tsx's fixedIncomeAccruedValue.
function fixedIncomeAccruedValue(h: StoredHolding): number {
  const principal = Number(h.principal) || 0;
  if (h.paymentFrequency !== "at_maturity") return principal;

  const purchase = new Date(String(h.purchaseDate)).getTime();
  const maturity = new Date(String(h.maturityDate)).getTime();
  const now = Date.now();
  if (!Number.isFinite(purchase) || !Number.isFinite(maturity) || maturity <= purchase) return principal;

  const daysTotal = Math.max(1, (maturity - purchase) / 86_400_000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (now - purchase) / 86_400_000));
  const annualRate = Number(h.annualRate) || 0;
  return principal * (1 + (annualRate / 100) * (daysElapsed / 365));
}

function personalAssetValueEGP(h: StoredHolding, usdToEgp: number): number {
  const v = (h.currentValue as number | undefined) ?? (h.purchasePrice as number | undefined) ?? 0;
  return h.currency === "USD" ? v * usdToEgp : v;
}

function computeHoldingValue(
  h: StoredHolding,
  goldUsd: number,
  silverUsd: number,
  usdToEgp: number,
  egxPrices: Record<string, number>,
): number {
  switch (h.type) {
    case "gold":
      return (Number(h.grams) || 0) * goldPricePerGram(goldUsd, usdToEgp, (h.karat as GoldKarat) ?? "24k");
    case "silver":
      return (Number(h.grams) || 0) * silverPricePerGram(silverUsd, usdToEgp);
    case "stock": {
      const price = egxPrices[String(h.symbol)] ?? (Number(h.purchasePricePerShare) || 0);
      return (Number(h.shares) || 0) * price;
    }
    case "fixed_income":
      return fixedIncomeAccruedValue(h);
    case "personal_asset":
      return personalAssetValueEGP(h, usdToEgp);
    case "real_estate":
      // No live day-to-day feed for this on the server (the curated
      // per-area dataset only ships with the mobile bundle) — real estate
      // doesn't move day-to-day anyway, so the last valuation is a fine
      // stand-in for the purpose of detecting a ±1% portfolio swing.
      return (h.currentValue as number | undefined) ?? (h.purchasePrice as number | undefined) ?? 0;
    default:
      return 0;
  }
}

/** Total current value (EGP) of one user's holdings + cash accounts. */
export async function computeUserPortfolioValue(userId: string): Promise<number> {
  const [holdingRows, cashRows, prices, egxStocks] = await Promise.all([
    db.select().from(holdingsTable).where(eq(holdingsTable.userId, userId)),
    db.select().from(cashAccountsTable).where(eq(cashAccountsTable.userId, userId)),
    fetchPrices(),
    fetchStocks().catch(() => []), // stock pricing degrades to purchase price if this fails
  ]);

  const egxPrices: Record<string, number> = {};
  for (const s of egxStocks) egxPrices[s.symbol] = s.price;

  const holdingsTotal = holdingRows.reduce((sum, row) => {
    const holding = { id: row.id, type: row.type, ...(decryptFromStorage(row.data) as object) } as StoredHolding;
    return sum + computeHoldingValue(holding, prices.goldUsd, prices.silverUsd, prices.usdToEgp, egxPrices);
  }, 0);

  // Cash accounts are summed as-is regardless of currency, matching the
  // existing (naive) behavior of CashContext.tsx's totalCash on the client.
  const cashTotal = cashRows.reduce((sum, row) => {
    const account = { id: row.id, ...(decryptFromStorage(row.data) as object) } as StoredCashAccount;
    return sum + (Number(account.balance) || 0);
  }, 0);

  return holdingsTotal + cashTotal;
}
