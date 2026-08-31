import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { db, usersTable, activityLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sendPushToTokens } from "../lib/expoPush";

const router: IRouter = Router();

router.use("/activity", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// A cheap DB insert plus one push send, not an LLM call — this ceiling
// exists purely as a backstop against a runaway client bug (this exact
// codebase already hit one: a push-registration retry storm), not to limit
// real usage. Someone actively reorganizing their portfolio could
// realistically save dozens of times in an hour.
const activityLogLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuth(req).userId ?? "anonymous",
});

const VALID_TYPES = new Set(["cash_added", "cash_edited", "holding_added", "holding_edited", "holding_sold"]);

// Generic, per-type push copy in the recipient's device language. The
// activity-log ROW keeps the client's own specific title/subtitle exactly
// as sent (e.g. "Gold Added" / "5g at 21k, 12,450 EGP") — those are
// authored across many different screens (add-investment, cash-accounts,
// sell-holding, ...) using the app's own in-app language, which is a
// different, correct thing for the bell to follow. But localizing the PUSH
// itself by device language would mean every one of those call sites
// authoring a second, device-language version of its own specific message
// — real scope, not a one-file fix. This trades some specificity in the
// push text for being reliably in the right language everywhere.
const PUSH_COPY: Record<string, { en: [string, string]; ar: [string, string] }> = {
  cash_added:     { en: ["Cash Account Added", "Your cash account was saved."], ar: ["تمت إضافة حساب نقدي", "تم حفظ حسابك النقدي."] },
  cash_edited:    { en: ["Cash Account Updated", "Your cash account was updated."], ar: ["تم تحديث الحساب النقدي", "تم تحديث حسابك النقدي."] },
  holding_added:  { en: ["Investment Added", "Your new investment was saved."], ar: ["تمت إضافة استثمار", "تم حفظ استثمارك الجديد."] },
  holding_edited: { en: ["Investment Updated", "Your investment was updated."], ar: ["تم تحديث الاستثمار", "تم تحديث استثمارك."] },
  holding_sold:   { en: ["Investment Sold", "Your investment sale was recorded."], ar: ["تم بيع الاستثمار", "تم تسجيل عملية بيع استثمارك."] },
};

function generateActivityId(): string {
  return `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// GET /api/activity — this user's recent add/edit confirmations, newest
// first, merged client-side into the same Notification History list as
// price alerts and portfolio-value alerts (see useNotificationHistory.ts).
router.get("/activity", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rows = await db
      .select({
        id: activityLogTable.id,
        type: activityLogTable.type,
        title: activityLogTable.title,
        subtitle: activityLogTable.subtitle,
        createdAt: activityLogTable.createdAt,
      })
      .from(activityLogTable)
      .where(eq(activityLogTable.userId, userId))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(30);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "GET /activity failed");
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// POST /api/activity — logs a manual add/edit confirmation (cash account or
// investment holding) and, unlike every other push in this app (all
// server-cron-triggered), also sends one right away — the client calls
// this immediately after its own save succeeds, so there's no cron/poll
// delay to wait out.
router.post("/activity", activityLogLimit, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as Record<string, unknown>;
  const { type, title, subtitle, entityId } = body;
  if (typeof type !== "string" || !VALID_TYPES.has(type)) {
    res.status(400).json({ error: `type must be one of: ${[...VALID_TYPES].join(", ")}` });
    return;
  }
  if (typeof title !== "string" || !title.trim() || typeof subtitle !== "string" || !subtitle.trim()) {
    res.status(400).json({ error: "title and subtitle are required" });
    return;
  }
  if (entityId !== undefined && typeof entityId !== "string") {
    res.status(400).json({ error: "entityId must be a string" });
    return;
  }

  try {
    const [user] = await db
      .select({ pushToken: usersTable.pushToken, alertsEnabled: usersTable.activityAlertsEnabled, language: usersTable.language })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    // Only log a row (and thus show a bell entry) when a push is actually
    // going out for it — otherwise a muted/unregistered device would still
    // see "Cash account updated" in its notification history for something
    // it was never actually notified about.
    if (!user?.alertsEnabled || !user.pushToken) {
      res.status(204).end();
      return;
    }

    const row = { id: generateActivityId(), userId, type, entityId: entityId ?? null, title, subtitle };
    await db.insert(activityLogTable).values(row);
    res.status(201).json(row);
    // sendPushToTokens is itself best-effort and never rejects, so nothing
    // further to await/catch here — the response has already gone out. Push
    // text is the generic device-language PUSH_COPY, not the client's own
    // title/subtitle just stored above — see PUSH_COPY's comment.
    const [pushTitle, pushBody] = PUSH_COPY[type][user.language === "ar" ? "ar" : "en"];
    void sendPushToTokens([user.pushToken], pushTitle, pushBody, { type: "activity_log" });
  } catch (err) {
    req.log.error({ err }, "POST /activity failed");
    res.status(500).json({ error: "Failed to log activity" });
  }
});

export default router;
