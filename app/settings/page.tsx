import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailChangeForm } from "@/components/EmailChangeForm";
import { StripeConnectCard } from "@/components/StripeConnectCard";
import { SignOutButton } from "@/components/SignOutButton";
import { PAYMENTS_ENABLED } from "@/lib/features";

export default async function Settings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stripeAccount } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Keep projects' notification email in sync with the account email
  if (user.email) {
    await supabase
      .from("projects")
      .update({ owner_email: user.email })
      .eq("user_id", user.id)
      .neq("owner_email", user.email);
  }

  return (
    <main className="mx-auto max-w-2xl px-6">
      <header className="flex items-center justify-between border-b border-line py-5">
        <Link
          href="/dashboard"
          className="font-display text-sm font-semibold tracking-[0.4em]"
        >
          LYPO<span className="text-flame">.</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium transition hover:text-flame"
        >
          back to projects
        </Link>
      </header>

      <section className="py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          settings<span className="text-flame">.</span>
        </h1>

        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold">email</h2>
          <p className="mt-1 text-sm text-ink-soft">
            This is where sign-in links and response notifications go.
          </p>
          <EmailChangeForm currentEmail={user.email ?? ""} />
        </div>

        {PAYMENTS_ENABLED && (
          <StripeConnectCard connected={!!stripeAccount?.account_id} />
        )}

        <div className="mt-14 border-t border-line pt-6 text-sm">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
