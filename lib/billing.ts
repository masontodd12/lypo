import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { appOrigin } from "@/lib/site-url";
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

/**
 * The two plans: $30 a month or $300 a year. Each is a recurring Price in the
 * Stripe dashboard, and its id lives in the environment so the amounts can be
 * changed there without a deploy. STRIPE_PRICE_ID is the older single-price
 * name and still counts as the monthly one.
 */
export const PRICES = {
  month:
    process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID ?? "",
  year: process.env.STRIPE_PRICE_ID_YEARLY ?? "",
};

export type Interval = keyof typeof PRICES;

/** Whether Stripe is configured well enough to take a payment at all. */
export const STRIPE_READY = !!KEY && !!(PRICES.month || PRICES.year);

export function stripeClient(): Stripe {
  if (!KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(KEY);
}

/** Statuses Stripe considers a live, paid-up subscription. */
const LIVE = new Set(["active", "trialing"]);

export function isLive(status: string | null | undefined): boolean {
  return !!status && LIVE.has(status);
}

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
  return isLive(sub?.status);
}

/**
 * Takes an owner's sites down when their plan stops, and puts them back when
 * it starts again.
 *
 * "suspended" is its own status rather than "draft" so that coming back only
 * restores what billing took away, never a site the owner or an admin chose
 * to take offline. Every public surface already filters on "published", so
 * this one write is what takes the site, its forms, its store and its
 * sitemap down together. Nothing is deleted.
 *
 * Needs the service-role client: it is called from the webhook and the cron,
 * where nobody is signed in.
 */
export async function syncOwnerSites(
  db: SupabaseClient,
  userId: string,
  live: boolean,
): Promise<void> {
  let keepUp = live || !SUBSCRIPTIONS_ENABLED;
  if (!keepUp) {
    // Admins never lose their sites, the same as they can always publish.
    const { data } = await db.auth.admin.getUserById(userId);
    keepUp = isAdmin(data?.user);
  }

  const { error } = keepUp
    ? await db
        .from("projects")
        .update({ status: "published" })
        .eq("user_id", userId)
        .eq("status", "suspended")
    : await db
        .from("projects")
        .update({ status: "suspended" })
        .eq("user_id", userId)
        .eq("status", "published");
  if (error)
    console.error(`could not sync sites for ${userId}:`, error.message);
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

/**
 * A Stripe Checkout page for this user and plan.
 *
 * Shared by the settings and publish buttons (which POST) and /subscribe
 * (which a visitor reaches straight from the homepage pricing), so both
 * attach the user the same way the webhook expects.
 */
export async function createCheckout(
  db: SupabaseClient,
  user: Pick<User, "id" | "email">,
  interval: Interval,
  opts: { cancelPath?: string } = {},
): Promise<CheckoutResult> {
  if (!STRIPE_READY) {
    return { ok: false, status: 503, error: "Subscriptions are not switched on yet." };
  }
  const price = PRICES[interval];
  if (!price) {
    return { ok: false, status: 503, error: `The ${interval}ly plan is not set up yet.` };
  }

  const origin = appOrigin();

  // Reuse the customer if this person has subscribed before, so a lapsed
  // account resubscribes onto its own billing history rather than becoming a
  // second stranger with the same email.
  const existing = await getSubscription(db, user.id);

  try {
    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email }),
      // The webhook is what actually grants access, so the id it needs has
      // to survive the round trip through Stripe. On the subscription too,
      // because later renewals arrive without the checkout session.
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard?subscribed=1`,
      cancel_url: `${origin}${opts.cancelPath ?? "/dashboard"}`,
    });
    if (!session.url) throw new Error("Stripe returned no checkout url");
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("checkout session failed:", e);
    return { ok: false, status: 502, error: "Couldn't start checkout. Try again." };
  }
}
