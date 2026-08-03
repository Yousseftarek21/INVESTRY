import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Persisted AI Assistant conversation history, one row per turn (user or
// assistant), append-only. `data` holds { role, content } encrypted the same
// way as cash_accounts/holdings — chat content is free-text and can contain
// more sensitive detail than a plain balance number, so it gets the same
// at-rest protection as the rest of the user's financial data.
export const chatMessagesTable = pgTable("chat_messages", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable);
export const selectChatMessageSchema = createSelectSchema(chatMessagesTable);

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type DbChatMessage     = typeof chatMessagesTable.$inferSelect;
