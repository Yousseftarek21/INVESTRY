import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A shared, app-wide chat feed for feature requests / bug reports / "what's
// missing" — every signed-in user reads every row, so unlike holdings/cash/
// goals this is stored as plain text on purpose, never run through
// encryption.ts: that layer exists so only the owning user can ever read
// their own row, which is the opposite of what this table is for.
//
// No authorName column — the sender's display name/avatar are resolved at
// read time via lib/clerkIdentity.ts's fetchIdentities (the same utility
// the leaderboard/referral board already use), so a renamed Clerk account
// shows its current name on old messages instead of a stale cached one.
export const feedbackMessagesTable = pgTable("feedback_messages", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  message:   text("message").notNull(), // server-enforced <= 500 chars, see routes/feedback.ts
  likeCount: integer("like_count").notNull().default(0), // denormalized, kept in sync by the like-toggle route
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFeedbackMessageSchema = createInsertSchema(feedbackMessagesTable);
export const selectFeedbackMessageSchema = createSelectSchema(feedbackMessagesTable);

export type InsertFeedbackMessage = z.infer<typeof insertFeedbackMessageSchema>;
export type DbFeedbackMessage     = typeof feedbackMessagesTable.$inferSelect;
