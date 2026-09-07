import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STRIPE_READY, getSubscription, stripeClient } from "@/lib/billing";
import { appOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Sends someone to Stripe's own billing page.
 *
 * Cancelling, changing card, and downloading receipts all live there.
 * Building any of that ourselves would mean handling card details, and this
 * is both the honest and the far smaller answer.
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

  const sub = await getSubscription(supabase, user.id);
  if (!sub?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No subscription to manage." },
      { status: 404 },
    );
  }

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appOrigin()}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("portal session failed:", e);
    return NextResponse.json(
      { error: "Couldn't open billing. Try again." },
      { status: 502 },
    );
  }
}
