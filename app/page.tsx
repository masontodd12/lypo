import Link from "next/link";
import { PromptCta } from "@/components/PromptCta";
import { EXAMPLES } from "@/lib/examples";
import { FounderJsonLd } from "@/lib/founder";
import { createClient } from "@/lib/supabase/server";
import { SUBSCRIPTIONS_ENABLED, getSubscription, isLive } from "@/lib/billing";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const subscribed =
    SUBSCRIPTIONS_ENABLED && user
      ? isLive((await getSubscription(supabase, user.id))?.status)
      : false;

  return (
    <main className="min-h-screen">
      <FounderJsonLd />
      {/* ---------- Nav ---------- */}
      <header className="mx-auto flex max-w-6xl items-start justify-between px-6 pt-8">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.4em]"
        >
          LYPO<span className="text-flame">.</span>
        </Link>
        <nav className="text-right text-sm leading-7 font-medium">
          <Link href="#how" className="block transition hover:text-flame">
            how it works
          </Link>
          <Link href="#mission" className="block transition hover:text-flame">
            our mission
          </Link>
          <Link href="#examples" className="block transition hover:text-flame">
            examples
          </Link>
          {SUBSCRIPTIONS_ENABLED && (
            <Link href="#pricing" className="block transition hover:text-flame">
              pricing
            </Link>
          )}
          {user ? (
            <Link
              href="/dashboard"
              className="block font-medium text-flame transition hover:text-flame-bright"
            >
              my projects →
            </Link>
          ) : (
            <Link href="/login" className="block transition hover:text-flame">
              sign in
            </Link>
          )}
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-20">
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft sm:ml-[42%]">
          Real websites and apps, built by describing them in plain words. No
          code. No gatekeeping. Made for the people tech usually leaves out.
        </p>

        <h1 className="font-display mt-8 text-7xl leading-[0.95] font-semibold tracking-tighter sm:text-[8rem]">
          just
          <br />
          build it<span className="text-flame">.</span>
        </h1>

        <div className="mt-4 sm:flex sm:justify-end">
          <PromptCta />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-14 sm:grid-cols-3">
            {[
              {
                n: "01",
                step: "describe",
                body: "Say what you want in plain words. A signup page for your food drive. A portfolio. An app that splits expenses with your friends. If you can say it, you can build it.",
              },
              {
                n: "02",
                step: "shape",
                body: "It appears live in front of you. Change anything by asking — \u201Cmake it warmer,\u201D \u201Cadd a donate button.\u201D No tutorials, no manuals, no experience needed.",
              },
              {
                n: "03",
                step: "publish",
                body: "Pick your link and put it on the internet in one click. Your idea, live, today — not someday.",
              },
            ].map((item) => (
              <div key={item.n}>
                <p className="text-xs tracking-widest text-faint">{item.n}</p>
                <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  {item.step}
                  <span className="text-flame">.</span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Examples strip ---------- */}
      <section id="examples" className="border-t border-line bg-mist/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            built with lypo<span className="text-flame">.</span>
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Real kinds of things real people make here — described in a
            sentence, live the same day.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {EXAMPLES.slice(0, 6).map((example) => (
              <Link
                key={example.name}
                href={`/onboarding?idea=${encodeURIComponent(example.idea)}`}
                className="group/card rounded-xl border border-line bg-paper p-4 transition hover:border-flame"
              >
                {example.preview}
                <p className="font-display mt-4 font-semibold">{example.name}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{example.kind}</p>
                <p className="mt-2 text-xs font-medium text-faint transition group-hover/card:text-flame">
                  start from this →
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-10 flex items-center justify-between">
            <p className="text-xs text-faint">
              Every one of these starts as a sentence and a vibe.
            </p>
            <Link
              href="/gallery"
              className="border-b-2 border-ink pb-1 text-sm font-medium transition hover:border-flame hover:text-flame"
            >
              see the live gallery →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      {/* Up front, so nobody meets the price for the first time at the
          publish button after an hour of building. */}
      {SUBSCRIPTIONS_ENABLED && (
        <section id="pricing" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight">
              pricing<span className="text-flame">.</span>
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
              Building and previewing are free, as long as you like. A plan
              is what puts your site live and keeps it there. Cancel any time
              and your site stays up until the end of what you paid for.
            </p>

            {subscribed ? (
              <p className="mt-10 text-sm">
                <span className="font-medium">You have a plan.</span>{" "}
                <Link href="/settings" className="text-flame hover:underline">
                  manage it in settings →
                </Link>
              </p>
            ) : (
              <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-6">
                  <p className="lypo-label text-faint">monthly</p>
                  <p className="font-display mt-2 text-4xl font-semibold tracking-tight">
                    $30
                    <span className="text-base font-normal text-ink-soft">
                      {" "}
                      / month
                    </span>
                  </p>
                  <a
                    href="/subscribe?plan=month"
                    className="mt-6 inline-block rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-flame-bright"
                  >
                    get monthly
                  </a>
                </div>
                <div className="rounded-xl border border-flame p-6">
                  <p className="lypo-label text-flame">yearly · 2 months free</p>
                  <p className="font-display mt-2 text-4xl font-semibold tracking-tight">
                    $300
                    <span className="text-base font-normal text-ink-soft">
                      {" "}
                      / year
                    </span>
                  </p>
                  <a
                    href="/subscribe?plan=year"
                    className="mt-6 inline-block rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-flame-bright"
                  >
                    get yearly
                  </a>
                </div>
              </div>
            )}

            <ul className="mt-8 max-w-md space-y-1 text-sm text-ink-soft">
              <li>Every site you build, published and live</li>
              <li>Your own lypo.dev address, or connect a domain you own</li>
              <li>Forms, bookings and visit counts for each site</li>
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Mission ---------- */}
      <section id="mission" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:flex sm:items-start sm:justify-between sm:gap-16">
          <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:max-w-xs">
            why lypo<span className="text-flame">?</span>
          </h2>
          <div className="mt-8 max-w-md sm:mt-0">
            <p className="leading-relaxed text-ink-soft">
              Good ideas die every day — not because they weren&apos;t good,
              but because someone couldn&apos;t afford a developer, never got
              taught to code, or was never told tech was for them. Lypo exists
              to tear that barrier down. We build for the organizers, students,
              hustlers, small nonprofits, and first-time builders in
              communities the digital world keeps leaving behind.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              If you can describe your idea, you can build it. That&apos;s the
              whole promise.
            </p>
            <Link
              href={user ? "/dashboard" : "/onboarding"}
              className="mt-8 inline-block border-b-2 border-ink pb-1 font-medium transition hover:border-flame hover:text-flame"
            >
              {user ? "go to my projects →" : "start building →"}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-faint">
          <span>no code · no gatekeeping</span>
          <span>
            lypo © {new Date().getFullYear()} · made by{" "}
            <Link href="/about" className="transition hover:text-flame">
              Mason Todd
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
