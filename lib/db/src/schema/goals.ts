import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGoalSchema = createInsertSchema(goalsTable);
export const selectGoalSchema = createSelectSchema(goalsTable);

export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type DbGoal     = typeof goalsTable.$inferSelect;
