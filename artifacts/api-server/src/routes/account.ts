import { Router, type IRouter } from "express";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable, holdingsTable, cashAccountsTable, rentalRecordsTable, rentalUnitsTable, rentalBookingsTable, rentalLeasesTable, rentalExpensesTable, loansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// Require a valid Clerk session
router.use("/account", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// DELETE /api/account — permanently delete the user's data and their
// Clerk account itself (Apple 5.1.1(v) requires real in-app account
// deletion, not just clearing local/server data).
router.delete("/account", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await db.delete(holdingsTable).where(eq(holdingsTable.userId, userId));
    await db.delete(cashAccountsTable).where(eq(cashAccountsTable.userId, userId));
    // Rental records are a new table (2026-09) added specifically without
    // repeating the pre-existing orphaning gap dividends/recurring_income
    // already have here (neither is cleaned up on account deletion today —
    // out of scope to fix generally, but no reason to launch this table
    // with the same gap on day one).
    await db.delete(rentalRecordsTable).where(eq(rentalRecordsTable.userId, userId));
    for (const table of [rentalBookingsTable, rentalLeasesTable, rentalExpensesTable, rentalUnitsTable]) {
      await db.delete(table).where(eq(table.userId, userId));
    }
    await db.execute(sql`DELETE FROM "rental_reminders_sent" WHERE "user_id" = ${userId}`);
    await db.delete(loansTable).where(eq(loansTable.userId, userId));
    await db.execute(sql`DELETE FROM "loan_reminders_sent" WHERE "user_id" = ${userId}`);
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await clerkClient.users.deleteUser(userId);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /account failed");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
