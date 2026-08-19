import { Router, type IRouter } from "express";
import { isNotNull } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { sendPushToTokens } from "../lib/expoPush";

const router: IRouter = Router();

// Manual broadcast tool — not tied to any specific feature launch, unlike
// competitionAnnouncement.ts's one-time self-limiting boot script. Guarded
// by a shared secret (ADMIN_BROADCAST_SECRET) rather than a Clerk session:
// this is an operator action, not a user-facing one, and there's no admin
// role/flag anywhere in usersTable to check against. Set the secret in
// Render's env vars, then call with:
//
//   curl -X POST https://api.investry.app/api/admin/broadcast-push \
//     -H "x-admin-secret: <the secret>" \
//     -H "Content-Type: application/json" \
//     -d '{"title": "...", "body": "..."}'
router.post("/admin/broadcast-push", async (req, res) => {
  const secret = process.env.ADMIN_BROADCAST_SECRET;
  if (!secret) {
    res.status(503).json({ error: "ADMIN_BROADCAST_SECRET is not configured on the server" });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !message) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  try {
    const rows = await db
      .select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(isNotNull(usersTable.pushToken));

    const tokens = rows.map(r => r.pushToken!).filter(Boolean);
    await sendPushToTokens(tokens, title, message, { type: "admin_broadcast" });

    res.json({ success: true, recipientCount: tokens.length });
  } catch (err) {
    req.log.error({ err }, "POST /admin/broadcast-push failed");
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

export default router;
