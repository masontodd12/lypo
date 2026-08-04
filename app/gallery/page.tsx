import Link from "next/link";
import { EXAMPLES } from "@/lib/examples";

export const dynamic = "force-dynamic";

export default function Gallery() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      <header className="flex items-center justify-between py-8">
        <Link href="/" className="font-display text-sm font-semibold tracking-[0.4em]">
          LYPO<span className="text-flame">.</span>
        </Link>
        <Link href="/onboarding" className="text-sm font-medium transition hover:text-flame">
          build your own →
        </Link>
      </header>

      <section className="pb-24 pt-10">
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          built with lypo<span className="text-flame">.</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          The kinds of things people make here. See one that feels like yours?
          Start from it and make it your own.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((example) => (
            <div key={example.name} className="rounded-xl border border-line bg-paper p-4 transition hover:border-flame">
              {example.preview}
              <div className="mt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display truncate font-semibold">{example.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{example.kind}</p>
                </div>
                <Link
                  href={`/onboarding?idea=${encodeURIComponent(example.idea)}`}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:border-flame hover:text-flame"
                >
                  start from this
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-faint">
          Every one of these starts as a sentence and a vibe. Yours will too.
        </p>
      </section>
    </main>
  );
}
