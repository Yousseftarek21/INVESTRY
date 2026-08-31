import { Router, type IRouter } from "express";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { db, usersTable, holdingsTable, cashAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await clerkClient.users.deleteUser(userId);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /account failed");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
