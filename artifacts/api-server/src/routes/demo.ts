import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db, holdingsTable, cashAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const DEMO_EMAIL = "demo@investry.app";
// Stable password — registered in App Store Connect "Sign-in required" section
// so Apple reviewers can also authenticate via email/password if the token flow fails.
const DEMO_PASSWORD = "Investry_Demo_2025!";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function getOrCreateDemoUser(): Promise<string> {
  const list = await clerkClient.users.getUserList({ emailAddress: [DEMO_EMAIL] });

  if (list.data.length > 0) {
    const userId = list.data[0].id;
    // Best-effort password reset — ensures the stable password works for new builds.
    // Swallow any error so the endpoint always succeeds even if the Clerk instance
    // doesn't allow programmatic password resets (e.g. strict password policies).
    try {
      await clerkClient.users.updateUser(userId, {
        password: DEMO_PASSWORD,
        skipPasswordChecks: true,
      });
    } catch {
      // non-fatal — demo user already exists, existing password is still usable
    }
    return userId;
  }

  const created = await clerkClient.users.createUser({
    emailAddress: [DEMO_EMAIL],
    firstName: "Demo",
    lastName: "Account",
    skipPasswordChecks: true,
    password: DEMO_PASSWORD,
  });
  return created.id;
}

async function ensureDemoData(userId: string): Promise<void> {
  const existing = await db
    .select({ id: holdingsTable.id })
    .from(holdingsTable)
    .where(eq(holdingsTable.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date();

  await db.insert(holdingsTable).values([
    {
      id: genId(),
      userId,
      type: "gold",
      data: {
        form: "physical",
        grams: 100,
        karat: "21k",
        purchaseDate: "2024-08-01",
        purchasePricePerGram: 3100,
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "gold",
      data: {
        form: "physical",
        grams: 50,
        karat: "24k",
        purchaseDate: "2025-01-10",
        purchasePricePerGram: 5800,
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "silver",
      data: {
        form: "physical",
        grams: 500,
        purchaseDate: "2024-11-20",
        purchasePricePerGram: 65,
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "stock",
      data: {
        symbol: "COMI.CA",
        companyName: "Commercial International Bank",
        shares: 500,
        purchaseDate: "2024-06-15",
        purchasePricePerShare: 58.5,
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "stock",
      data: {
        symbol: "HRHO.CA",
        companyName: "Hermes Financial",
        shares: 1000,
        purchaseDate: "2025-03-01",
        purchasePricePerShare: 28.0,
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "real_estate",
      data: {
        propertyType: "Apartment",
        propertyName: "New Cairo Apartment",
        governorate: "Cairo",
        city: "New Cairo",
        district: "Fifth Settlement",
        area: 120,
        purchaseDate: "2023-05-01",
        purchasePrice: 2400000,
        currentMarketPricePerM2: 28000,
        currentValue: 3360000,
        lastValuationDate: "2025-01-01",
        valuationSource: "Market estimate",
        notes: "",
      },
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(cashAccountsTable).values([
    {
      id: genId(),
      userId,
      type: "bank",
      data: {
        accountName: "CIB Savings",
        balance: 75000,
        currency: "EGP",
        dateAdded: "2025-01-01",
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: genId(),
      userId,
      type: "cash_home",
      data: {
        accountName: "Cash at Home",
        balance: 15000,
        currency: "EGP",
        dateAdded: "2025-01-01",
      },
      createdAt: now,
      updatedAt: now,
    },
  ]);

  logger.info({ userId }, "Demo user data seeded");
}

router.get("/demo/token", async (req, res) => {
  try {
    const userId = await getOrCreateDemoUser();
    await ensureDemoData(userId);
    // Return success — the mobile client signs in via email/password directly.
    // The token field is kept for backwards compatibility with any old builds.
    res.json({ ok: true, token: null });
  } catch (err: any) {
    req.log.error({ err }, "Failed to set up demo account");
    res.status(500).json({ error: "Failed to set up demo account" });
  }
});

export default router;
