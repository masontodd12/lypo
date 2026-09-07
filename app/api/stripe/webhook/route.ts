import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Stripe telling us what happened to a subscription.
 *
 * This is the only thing that grants or removes access. The browser coming
 * back from Checkout is not proof of anything: it can be navigated to by
 * hand, and it arrives before Stripe has necessarily settled the payment.
 *
 * Unauthenticated by necessity, since Stripe has no session. The signature is
 * what stands in for that, so it is verified against the raw body before a
 * single field is read.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set; webhook ignored");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // Raw text, never the parsed body: the signature covers the exact bytes,
  // and re-serialising JSON changes them.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, signature, secret);
  } catch (e) {
    console.error("stripe signature check failed:", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const db = createAdminClient();

  /** Writes one subscription's current state against the user who owns it. */
  async function save(sub: Stripe.Subscription, userId?: string | null) {
    const id = userId ?? sub.metadata?.user_id;
    if (!id) {
      // Nothing to attach it to. Logged loudly because it means a checkout
      // was created without the metadata the grant depends on.
      console.error(`subscription ${sub.id} has no user_id metadata`);
      return;
    }

    // Stripe moved the period on to the item in recent API versions, so read
    // whichever is present rather than assuming a shape.
    const periodEnd =
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      sub.items?.data?.[0]?.current_period_end ??
      null;

    const { error } = await db.from("subscriptions").upsert(
      {
        user_id: id,
        stripe_customer_id:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) console.error("could not save subscription:", error.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        // The session carries an id but not the subscription's status, so
        // fetch the real thing rather than assuming it is active.
        const sub = await stripeClient().subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
        await save(sub, session.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await save(event.data.object);
        break;
      }
      default:
        // Everything else is noise for our purposes. Acknowledged so Stripe
        // stops retrying it.
        break;
    }
  } catch (e) {
    // A 500 makes Stripe retry, which is what we want for a transient fault.
    console.error(`webhook ${event.type} failed:`, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
