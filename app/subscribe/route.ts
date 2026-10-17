import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SUBSCRIPTIONS_ENABLED,
  createCheckout,
  getSubscription,
  isLive,
  type Interval,
} from "@/lib/billing";
import { appOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * Subscribing straight from the homepage: /subscribe?plan=month or year.
 *
 * A visitor who is not signed in goes through sign-in and comes back here,
 * then on to Stripe, so picking a plan is one click however they arrive.
 * Opening a checkout page is harmless on its own, nothing is charged until
 * they pay on Stripe, so a plain link is fine.
 */
export async function GET(request: Request) {
  const origin = appOrigin();
  const plan = new URL(request.url).searchParams.get("plan");
  const interval: Interval = plan === "year" ? "year" : "month";
  const here = `/subscribe?plan=${interval}`;

  if (!SUBSCRIPTIONS_ENABLED) {
    return NextResponse.redirect(`${origin}/onboarding`, 303);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?next=${encodeURIComponent(here)}`,
      303,
    );
  }

  // Already paying: a second subscription would bill them twice.
  const sub = await getSubscription(supabase, user.id);
  if (isLive(sub?.status)) {
    return NextResponse.redirect(`${origin}/settings`, 303);
  }

  const result = await createCheckout(supabase, user, interval, {
    cancelPath: "/#pricing",
  });
  return NextResponse.redirect(
    result.ok ? result.url : `${origin}/settings`,
    303,
  );
}
