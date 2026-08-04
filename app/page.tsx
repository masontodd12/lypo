import Link from "next/link";
import { PromptCta } from "@/components/PromptCta";
import { EXAMPLES } from "@/lib/examples";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen">
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
          <span>lypo © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}
