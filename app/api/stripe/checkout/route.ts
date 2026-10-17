import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckout, type Interval } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Starts a Stripe Checkout session for a Lypo subscription.
 *
 * Money comes to us here, on our own account. There is no Connect, no
 * per-user Stripe account and no payout to anybody else: that was a
 * different product and it was removed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // { interval: "month" | "year" }; monthly when nothing is said.
  const body = await request.json().catch(() => ({}));
  const interval: Interval = body?.interval === "year" ? "year" : "month";

  const result = await createCheckout(supabase, user, interval);
  return result.ok
    ? NextResponse.json({ url: result.url })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
