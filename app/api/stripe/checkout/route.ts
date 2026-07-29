import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrlFor } from "@/lib/site-url";

// Creates a checkout session that pays the SITE OWNER's connected account.
// Called from published sites when a visitor clicks a .lypo-pay button.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments aren't enabled yet." },
      { status: 501 },
    );
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { projectId, amount, label } = await request.json();
  if (!projectId || !amount || amount < 100) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("user_id, name, slug")
    .eq("id", projectId)
    .eq("status", "published")
    .single();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: account } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", project.user_id)
    .maybeSingle();
  if (!account?.account_id) {
    return NextResponse.json(
      { error: "This site hasn't set up payments yet." },
      { status: 400 },
    );
  }

  // Verify the connected account can actually accept charges (fully onboarded)
  const acct = await stripe.accounts.retrieve(account.account_id);
  if (!acct.charges_enabled) {
    return NextResponse.json(
      {
        error:
          "This site's payment setup isn't finished yet. Please try again later.",
      },
      { status: 400 },
    );
  }

  const liveUrl = siteUrlFor(project.slug);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount, // cents
            product_data: { name: label || `Payment to ${project.name}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${liveUrl}?paid=1`,
      cancel_url: liveUrl,
    },
    { stripeAccount: account.account_id }, // money goes to the site owner
  );

  return NextResponse.json({ url: session.url });
}
