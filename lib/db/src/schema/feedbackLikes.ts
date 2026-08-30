import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per (message, user) like — the unique constraint is what makes
// the like-toggle route correct without a separate read-then-write check:
// insert if absent (like), delete if present (unlike), one per user per
// message either way.
export const feedbackLikesTable = pgTable("feedback_likes", {
  id:        text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  userId:    text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  messageUserUnique: unique().on(t.messageId, t.userId),
}));

export const insertFeedbackLikeSchema = createInsertSchema(feedbackLikesTable);
export const selectFeedbackLikeSchema = createSelectSchema(feedbackLikesTable);

export type InsertFeedbackLike = z.infer<typeof insertFeedbackLikeSchema>;
export type DbFeedbackLike     = typeof feedbackLikesTable.$inferSelect;
