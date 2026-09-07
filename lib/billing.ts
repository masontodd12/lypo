import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Paying for Lypo, which is what lets a site be published.
 *
 * Building and previewing stay free. The line is drawn at publishing because
 * that is the moment the site becomes worth something to its owner, and it is
 * a single chokepoint: one check in one route rather than a permission spread
 * across the app.
 */

/**
 * The master switch.
 *
 * Off means everybody can publish, exactly as before this existed. It is here
 * because this is going live the day before launch: if the webhook misfires
 * on the morning, one environment variable puts every user back to working
 * instead of every user being locked out of the thing they came to do.
 */
export const SUBSCRIPTIONS_ENABLED =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === "true";

const KEY = process.env.STRIPE_SECRET_KEY ?? "";

/** Whether Stripe is configured well enough to take a payment at all. */
export const STRIPE_READY = !!KEY && !!process.env.STRIPE_PRICE_ID;

export function stripeClient(): Stripe {
  if (!KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(KEY);
}

/** Statuses Stripe considers a live, paid-up subscription. */
const LIVE = new Set(["active", "trialing"]);

export type Subscription = {
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
};

/** This user's subscription row, or null. Never throws. */
export async function getSubscription(
  db: SupabaseClient,
  userId: string,
): Promise<Subscription | null> {
  try {
    const { data } = await db
      .from("subscriptions")
      .select("status, stripe_customer_id, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as Subscription) ?? null;
  } catch {
    // Table missing until the migration runs. Treated as "no subscription",
    // which only matters while the switch above is on.
    return null;
  }
}

/**
 * May this user publish?
 *
 * Admins always can, so nobody can lock themselves out of their own product,
 * and so support can reproduce a customer's site without buying a plan.
 */
export async function canPublish(
  db: SupabaseClient,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  if (!SUBSCRIPTIONS_ENABLED) return true;
  if (isAdmin(user)) return true;
  const sub = await getSubscription(db, user.id);
  return !!sub && LIVE.has(sub.status);
}
