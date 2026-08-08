import Link from "next/link";
import { EXAMPLES } from "@/lib/examples";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrlFor } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type Featured = { id: string; name: string; slug: string; html: string | null };

/**
 * Real sites an admin has chosen to show off.
 *
 * Best-effort: the featured column may not exist yet, and the gallery is
 * still worth showing without it. Service role because these are other
 * people's rows, and only ones explicitly marked featured are read.
 */
async function getFeatured(): Promise<Featured[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("projects")
      .select("id, name, slug, html")
      .eq("featured", true)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(12);
    if (error) return [];
    return (data ?? []).filter((p): p is Featured => !!p.slug);
  } catch {
    return [];
  }
}

export default async function Gallery() {
  const featured = await getFeatured();
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

        {featured.length > 0 && (
          <>
            <h2 className="font-display mt-12 text-lg font-semibold tracking-tight">
              real sites, live right now
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((site) => (
                <a
                  key={site.id}
                  href={siteUrlFor(site.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/card rounded-xl border border-line bg-paper p-4 transition hover:border-flame"
                >
                  <div className="h-40 overflow-hidden rounded-lg border border-line bg-ink">
                    {site.html ? (
                      <iframe
                        srcDoc={site.html}
                        sandbox=""
                        tabIndex={-1}
                        aria-hidden="true"
                        title=""
                        className="pointer-events-none h-[640px] w-[400%] origin-top-left scale-25 bg-paper"
                      />
                    ) : null}
                  </div>
                  <p className="font-display mt-4 font-semibold">{site.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {siteUrlFor(site.slug).replace(/^https?:\/\//, "")}
                  </p>
                  <p className="mt-2 text-xs font-medium text-faint transition group-hover/card:text-flame">
                    visit the site →
                  </p>
                </a>
              ))}
            </div>

            <h2 className="font-display mt-14 text-lg font-semibold tracking-tight">
              and the kinds of things you could make
            </h2>
          </>
        )}

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
