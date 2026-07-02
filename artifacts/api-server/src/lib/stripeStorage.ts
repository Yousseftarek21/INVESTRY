import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * Application-side storage: our `users` table plus read-only queries against
 * the `stripe.*` schema tables that stripe-replit-sync keeps in sync.
 */
export class StripeStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  async upsertUser(id: string, email: string | null) {
    const [user] = await db
      .insert(usersTable)
      .values({ id, email: email ?? undefined })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { email: email ?? undefined, updatedAt: new Date() },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    info: { stripeCustomerId?: string; stripeSubscriptionId?: string | null; plan?: string; billingPeriod?: string },
  ) {
    const [user] = await db
      .update(usersTable)
      .set({ ...info, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`,
    );
    return result.rows[0] || null;
  }

  /**
   * Active prices tagged with planKey/billingPeriod metadata (set by
   * scripts/src/seed-products.ts). Used to map a plan + billing period
   * chosen in the app to a concrete Stripe price ID without hardcoding IDs.
   */
  async getPriceCatalog() {
    const result = await db.execute(
      sql`SELECT id, unit_amount, currency,
                 metadata->>'planKey' AS plan_key,
                 metadata->>'billingPeriod' AS billing_period
          FROM stripe.prices
          WHERE active = true
            AND metadata->>'planKey' IS NOT NULL
            AND metadata->>'billingPeriod' IS NOT NULL`,
    );
    return result.rows as Array<{
      id: string;
      unit_amount: number;
      currency: string;
      plan_key: string;
      billing_period: string;
    }>;
  }
}

export const stripeStorage = new StripeStorage();
