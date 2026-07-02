import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:                     text("id").primaryKey(), // Clerk userId
  email:                  text("email"),
  stripeCustomerId:       text("stripe_customer_id"),
  stripeSubscriptionId:   text("stripe_subscription_id"),
  plan:                   text("plan").notNull().default("free"), // 'free' | 'pro' | 'pro_plus'
  billingPeriod:          text("billing_period").notNull().default("monthly"), // 'monthly' | 'annual'
  createdAt:              timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export const selectUserSchema = createSelectSchema(usersTable);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type DbUser     = typeof usersTable.$inferSelect;
