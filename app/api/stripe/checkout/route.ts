import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STRIPE_READY, getSubscription, stripeClient } from "@/lib/billing";
import { appOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Starts a Stripe Checkout session for a Lypo subscription.
 *
 * Money comes to us here, on our own account. There is no Connect, no
 * per-user Stripe account and no payout to anybody else: that was a
 * different product and it was removed.
 */
export async function POST() {
  if (!STRIPE_READY) {
    return NextResponse.json(
      { error: "Subscriptions are not switched on yet." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const origin = appOrigin();
  const stripe = stripeClient();

  // Reuse the customer if this person has subscribed before, so a lapsed
  // account resubscribes onto its own billing history rather than becoming a
  // second stranger with the same email.
  const existing = await getSubscription(supabase, user.id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
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
      cancel_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout session failed:", e);
    return NextResponse.json(
      { error: "Couldn't start checkout. Try again." },
      { status: 502 },
    );
  }
}
