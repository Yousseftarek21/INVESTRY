import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks the actual outcome of every push notification this server sends,
// closing a real blind spot: before this table existed, sendPushToTokens()
// only checked whether the HTTP request to Expo itself succeeded (res.ok) —
// never the per-token result in the response body. Expo's push API returns
// 200 OK even when an individual send fails (e.g. a dead token comes back
// as a "DeviceNotRegistered" ticket/receipt), so a stale token could sit in
// users.push_token forever with every send against it silently doing
// nothing, and nobody — not the logs, not the database, not this app's own
// code — could ever answer "did this push actually go out."
//
// Expo push delivery has two stages, and this table follows both:
//   1. "ticket" — Expo's immediate response to POST /push/send. `ok` here
//      only means "accepted for delivery," not "delivered."
//   2. "receipt" — the real outcome, fetched later (Expo recommends
//      waiting a few minutes) from POST /push/getReceipts using the
//      ticket's id. This is the first point a stale/revoked token is
//      guaranteed to surface as DeviceNotRegistered if the ticket stage
//      didn't already catch it.
// stage records which of the two produced the row's current status —
// pushReceiptCron.ts advances a 'ticket'/'pending' row to 'receipt' once
// Expo's receipt is back (or to 'unknown' if it never arrives within the
// give-up window Expo itself documents receipts are retained for).
export const pushTicketsTable = pgTable("push_tickets", {
  id:           text("id").primaryKey(), // Expo's own ticket id
  userId:       text("user_id"), // null if the token no longer matched any user at send time (e.g. reassigned mid-flight)
  token:        text("token").notNull(),
  type:         text("type").notNull(), // the same `type` tag every push already carries in its data payload (see useNotificationTapRouting.ts's DESTINATION map)
  status:       text("status").notNull().default("pending"), // 'pending' | 'success' | 'error' | 'unknown'
  stage:        text("stage").notNull().default("ticket"), // 'ticket' | 'receipt' — which check last set `status`
  errorCode:    text("error_code"), // e.g. 'DeviceNotRegistered', 'MessageTooBig', 'InvalidCredentials'
  errorMessage: text("error_message"),
  sentAt:       timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  checkedAt:    timestamp("checked_at", { withTimezone: true }), // set once status leaves 'pending'
});

export const insertPushTicketSchema = createInsertSchema(pushTicketsTable);
export const selectPushTicketSchema = createSelectSchema(pushTicketsTable);

export type InsertPushTicket = z.infer<typeof insertPushTicketSchema>;
export type DbPushTicket     = typeof pushTicketsTable.$inferSelect;
