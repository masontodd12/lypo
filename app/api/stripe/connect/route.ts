import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Starts Stripe Connect onboarding for the signed-in user.
// Requires: npm install stripe, STRIPE_SECRET_KEY in .env.local
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments aren't enabled yet." },
      { status: 501 },
    );
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Reuse existing account if the user already has one
  const { data: profile } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let accountId = profile?.account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
    });
    accountId = account.id;
    await supabase
      .from("stripe_accounts")
      .insert({ user_id: user.id, account_id: accountId });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${site}/dashboard?stripe=refresh`,
    return_url: `${site}/dashboard?stripe=connected`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
