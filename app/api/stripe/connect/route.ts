import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured yet (missing Stripe key)." },
      { status: 501 },
    );
  }

  try {
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
      const { error: insertError } = await supabase
        .from("stripe_accounts")
        .insert({ user_id: user.id, account_id: accountId });
      if (insertError) {
        console.error("stripe_accounts insert failed:", insertError.message);
        return NextResponse.json(
          { error: `Could not save payment account: ${insertError.message}` },
          { status: 500 },
        );
      }
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://lypo.dev";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${site}/settings?stripe=refresh`,
      return_url: `${site}/settings?stripe=connected`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("Stripe connect error:", message);
    return NextResponse.json(
      { error: `Stripe error: ${message}` },
      { status: 500 },
    );
  }
}
