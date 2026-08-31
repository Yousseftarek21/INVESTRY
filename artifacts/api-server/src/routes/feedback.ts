import { Router, type IRouter } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, feedbackMessagesTable, feedbackLikesTable, usersTable } from "@workspace/db";
import { eq, and, asc, sql, count, isNotNull, ne } from "drizzle-orm";
import crypto from "crypto";
import { fetchIdentities, FALLBACK_NAME } from "../lib/clerkIdentity";
import { sendPushToTokens } from "../lib/expoPush";

const PUSH_PREVIEW_LENGTH = 100;

const router: IRouter = Router();

const MAX_MESSAGE_LENGTH = 500;

// Require a valid Clerk session for every feedback route — this is a shared
// board across all users, not admin-only, so any signed-in user passes.
router.use("/feedback", clerkMiddleware(), (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// GET /api/feedback — the whole shared feed, oldest first (rendered as a
// real chat log client-side), with each message's sender identity resolved
// via fetchIdentities (same utility the leaderboard uses — no authorName
// column, no staleness) and whether the current user has liked it.
router.get("/feedback", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [messages, myLikes] = await Promise.all([
      db.select().from(feedbackMessagesTable).orderBy(asc(feedbackMessagesTable.createdAt)),
      db.select({ messageId: feedbackLikesTable.messageId })
        .from(feedbackLikesTable)
        .where(eq(feedbackLikesTable.userId, userId)),
    ]);

    const likedIds = new Set(myLikes.map(l => l.messageId));
    const identities = await fetchIdentities(messages.map(m => m.userId));

    res.json(messages.map(m => {
      const identity = identities.get(m.userId) ?? { name: FALLBACK_NAME, imageUrl: null };
      return {
        id: m.id,
        userId: m.userId,
        message: m.message,
        likeCount: m.likeCount,
        hasLiked: likedIds.has(m.id),
        createdAt: m.createdAt,
        senderName: identity.name,
        senderImageUrl: identity.imageUrl,
        isMe: m.userId === userId,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "GET /feedback failed");
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// GET /api/feedback/summary — total message count + the newest message's
// timestamp, cheap enough to poll from Settings (a COUNT + a MAX, not the
// whole feed) so a "new since you last opened it" badge can show up
// without fetching every message just to count them. The client compares
// this against a locally-stored "last seen" marker (see feedback.tsx) —
// nothing server-side tracks per-user read state, so this alone can't tell
// you *how many* are unread, just whether anything changed since a given
// point, which is all the badge needs.
router.get("/feedback/summary", async (req, res) => {
  try {
    const [row] = await db.select({
      count: count(),
      latestCreatedAt: sql<string | null>`max(${feedbackMessagesTable.createdAt})`,
    }).from(feedbackMessagesTable);
    res.json({ count: row?.count ?? 0, latestCreatedAt: row?.latestCreatedAt ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /feedback/summary failed");
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// POST /api/feedback — send a message into the shared feed. Returns the
// created row (identity resolved) so the client can append it directly
// instead of refetching the whole feed.
router.post("/feedback", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const raw = (req.body as Record<string, unknown>)?.message;
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) { res.status(400).json({ error: "message is required" }); return; }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    return;
  }

  try {
    const id = crypto.randomUUID();
    const [row] = await db.insert(feedbackMessagesTable)
      .values({ id, userId, message })
      .returning();

    const identities = await fetchIdentities([userId]);
    const identity = identities.get(userId) ?? { name: FALLBACK_NAME, imageUrl: null };

    res.status(201).json({
      id: row.id,
      userId: row.userId,
      message: row.message,
      likeCount: row.likeCount,
      hasLiked: false,
      createdAt: row.createdAt,
      senderName: identity.name,
      senderImageUrl: identity.imageUrl,
      isMe: true,
    });

    // Notified on every message, to every OTHER user who has opted in —
    // explicit product choice on "every message" (a throttled digest was
    // flagged as the safer default against notification fatigue on a board
    // that could get busy), but opt-in-only is the safeguard against that
    // same risk: feedbackAlertsEnabled defaults false, so nobody gets this
    // unless they deliberately turned it on (Settings -> Notifications).
    // Response has already gone out above; this runs after, same
    // "best-effort, never blocks the request" pattern as activity.ts's own
    // push send.
    void (async () => {
      try {
        const rows = await db
          .select({ pushToken: usersTable.pushToken })
          .from(usersTable)
          .where(and(
            isNotNull(usersTable.pushToken),
            ne(usersTable.id, userId),
            eq(usersTable.feedbackAlertsEnabled, true),
          ));
        const tokens = rows.map(r => r.pushToken!).filter(Boolean);
        if (tokens.length === 0) return;

        const senderFirstName = identity.name.trim().split(/\s+/)[0] || identity.name;
        const preview = message.length > PUSH_PREVIEW_LENGTH ? `${message.slice(0, PUSH_PREVIEW_LENGTH)}…` : message;
        await sendPushToTokens(
          tokens,
          "💬 New in Feedback & Ideas",
          `${senderFirstName}: ${preview}`,
          { type: "feedback_message" },
        );
      } catch (err) {
        req.log.error({ err }, "POST /feedback: notification broadcast failed");
      }
    })();
  } catch (err) {
    req.log.error({ err }, "POST /feedback failed");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/feedback/:id/like — toggle: insert the (message, user) row if
// absent (like), delete it if present (unlike). The unique constraint on
// feedback_likes makes this correct without a separate read-then-write
// check for the common case; a 23505 from a race is treated as "already
// liked" rather than surfaced as an error.
router.post("/feedback/:id/like", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const messageId = req.params.id;

  try {
    const existing = await db.select().from(feedbackLikesTable)
      .where(and(eq(feedbackLikesTable.messageId, messageId), eq(feedbackLikesTable.userId, userId)));

    let hasLiked: boolean;
    if (existing.length > 0) {
      await db.delete(feedbackLikesTable)
        .where(and(eq(feedbackLikesTable.messageId, messageId), eq(feedbackLikesTable.userId, userId)));
      await db.update(feedbackMessagesTable)
        .set({ likeCount: sql`GREATEST(${feedbackMessagesTable.likeCount} - 1, 0)` })
        .where(eq(feedbackMessagesTable.id, messageId));
      hasLiked = false;
    } else {
      try {
        await db.insert(feedbackLikesTable).values({ id: `${messageId}::${userId}`, messageId, userId });
      } catch (err: unknown) {
        const pg = err as { code?: string };
        if (pg.code !== "23505") throw err; // anything but "already liked" is a real error
      }
      await db.update(feedbackMessagesTable)
        .set({ likeCount: sql`${feedbackMessagesTable.likeCount} + 1` })
        .where(eq(feedbackMessagesTable.id, messageId));
      hasLiked = true;
    }

    const [updated] = await db.select({ likeCount: feedbackMessagesTable.likeCount })
      .from(feedbackMessagesTable)
      .where(eq(feedbackMessagesTable.id, messageId));
    if (!updated) { res.status(404).json({ error: "Message not found" }); return; }

    res.json({ likeCount: updated.likeCount, hasLiked });
  } catch (err) {
    req.log.error({ err }, "POST /feedback/:id/like failed");
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
