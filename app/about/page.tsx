import type { Metadata } from "next";
import Link from "next/link";
import { FOUNDER, FounderJsonLd } from "@/lib/founder";

// Titled with the name on purpose: a page whose title is exactly what
// someone searches for is the page most likely to be the answer.
export const metadata: Metadata = {
  title: `${FOUNDER} · founder of Lypo`,
  description: `${FOUNDER} is the founder of Lypo, the website builder where you describe a site and then have one.`,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    title: `${FOUNDER} · founder of Lypo`,
    description: `${FOUNDER} is the founder of Lypo.`,
  },
};

export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-6">
      <FounderJsonLd />
      <header className="flex items-center justify-between py-8">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.4em]"
        >
          LYPO<span className="text-flame">.</span>
        </Link>
        <Link
          href="/onboarding"
          className="text-sm font-medium transition hover:text-flame"
        >
          build your own →
        </Link>
      </header>

      <section className="pb-24 pt-10">
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          {FOUNDER.toLowerCase()}
          <span className="text-flame">.</span>
        </h1>
        <p className="mt-2 text-sm text-faint">founder of lypo</p>
        <p className="mt-8 text-base leading-relaxed text-ink-soft">
          Lypo is built by {FOUNDER}. You tell it what you need, a restaurant
          menu, a portfolio, a sign-up page, and it builds the site. No code,
          no templates to fight with.
        </p>
        <div className="mt-8 flex gap-5 text-sm font-medium">
          <Link href="/" className="transition hover:text-flame">
            lypo.dev
          </Link>
          <a
            href="https://github.com/masontodd12"
            rel="me noopener"
            target="_blank"
            className="transition hover:text-flame"
          >
            github ↗
          </a>
        </div>
      </section>
    </main>
  );
}
