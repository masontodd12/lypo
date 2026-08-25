import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail: string };

/**
 * Whether a table or column actually exists.
 *
 * Selecting from something missing returns an error rather than throwing,
 * which is exactly what makes it a usable probe: several features in this
 * app are written to work without their migration and simply do less, so
 * "did the migration run" is otherwise invisible from the outside.
 */
async function probe(
  label: string,
  // PostgREST builders are thenable but not real Promises.
  run: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<Check> {
  try {
    const { error } = await run();
    return {
      name: label,
      ok: !error,
      detail: error ? error.message.slice(0, 120) : "present",
    };
  } catch (e) {
    return {
      name: label,
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 120) : "failed",
    };
  }
}

export default async function AdminHealth() {
  const db = createAdminClient();

  const checks = await Promise.all([
    probe("projects.onboarding_draft (resume a half-finished interview)", () =>
      db.from("projects").select("onboarding_draft").limit(1),
    ),
    probe("projects.featured (show a real site in the gallery)", () =>
      db.from("projects").select("featured").limit(1),
    ),
    probe("site_events (phone and directions taps)", () =>
      db.from("site_events").select("event").limit(1),
    ),
    probe("site_views (visit counts)", () =>
      db.from("site_views").select("count").limit(1),
    ),
    probe("project_versions (version history)", () =>
      db.from("project_versions").select("id").limit(1),
    ),
    probe("project_grants (extra build allowance)", () =>
      db.from("project_grants").select("user_id").limit(1),
    ),
    probe("submissions (form responses)", () =>
      db.from("submissions").select("id").limit(1),
    ),
  ]);

  // The unique index cannot be probed by selecting, so look for the thing it
  // is supposed to prevent instead.
  const { data: published } = await db
    .from("projects")
    .select("slug")
    .not("slug", "is", null)
    .eq("status", "published");
  const counts = new Map<string, number>();
  for (const p of published ?? []) {
    counts.set(p.slug, (counts.get(p.slug) ?? 0) + 1);
  }
  const duplicateSlugs = [...counts.entries()].filter(([, n]) => n > 1);

  const missing = checks.filter((c) => !c.ok);
  // A distinct failure worth calling out by name: it is not a missing table,
  // it is the backend role having no access, which also silently breaks the
  // weekly digest cron.
  const grantsMissing = checks.some((c) =>
    /permission denied/i.test(c.detail),
  );
  const envSet = {
    fallbackModel: !!process.env.OPENAI_FALLBACK_MODEL,
    adminEmails: !!process.env.LYPO_ADMIN_EMAILS,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    resend: !!process.env.RESEND_API_KEY,
  };

  return (
    <section className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        health<span className="text-flame">.</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Whether the database has everything the code expects. Features whose
        migration has not run still work, they just quietly do less, so this
        is the only place that difference is visible.
      </p>

      <div
        className={`mt-6 rounded-xl border p-4 ${
          missing.length === 0
            ? "border-line bg-paper"
            : "border-flame/40 bg-flame/5"
        }`}
      >
        <p className="font-display text-sm font-semibold tracking-tight">
          {missing.length === 0
            ? "everything the code expects is present"
            : `${missing.length} thing${missing.length === 1 ? "" : "s"} missing`}
        </p>
        {missing.length > 0 && (
          <p className="mt-1 text-xs text-ink-soft">
            Run supabase-migration.sql in the Supabase SQL editor. It is safe
            to run more than once.
          </p>
        )}
        {grantsMissing && (
          <p className="mt-3 border-t border-flame/30 pt-3 text-xs leading-relaxed text-ink-soft">
            <span className="font-medium">
              These say &ldquo;permission denied&rdquo;, not &ldquo;missing&rdquo;.
            </span>{" "}
            The tables exist; the backend role cannot read them. The same role
            runs the weekly digest email, so that is failing too. The
            migration grants it access.
          </p>
        )}
      </div>

      <div className="mt-6 divide-y divide-line rounded-xl border border-line">
        {checks.map((c) => (
          <div
            key={c.name}
            className="flex items-start justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm">{c.name}</p>
              {!c.ok && (
                <p className="mt-0.5 text-xs text-flame">{c.detail}</p>
              )}
            </div>
            <span
              className={`shrink-0 text-xs font-medium ${
                c.ok ? "text-ink-soft" : "text-flame"
              }`}
            >
              {c.ok ? "ok" : "missing"}
            </span>
          </div>
        ))}
      </div>

      <h2 className="font-display mt-10 text-lg font-semibold tracking-tight">
        duplicate addresses
      </h2>
      {duplicateSlugs.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">
          No two published sites share a slug.
        </p>
      ) : (
        <div className="mt-2 rounded-xl border border-flame/40 bg-flame/5 p-4">
          <p className="text-sm">
            These would break both sites, since the public page expects one
            row per address. Rename one of each, then re-run the migration so
            the unique index can be created.
          </p>
          <ul className="mt-2 text-sm">
            {duplicateSlugs.map(([slug, n]) => (
              <li key={slug} className="font-mono text-xs">
                {slug} · {n} sites
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="font-display mt-10 text-lg font-semibold tracking-tight">
        configuration
      </h2>
      <div className="mt-2 divide-y divide-line rounded-xl border border-line">
        {[
          ["admin emails", envSet.adminEmails, "LYPO_ADMIN_EMAILS"],
          ["service role key", envSet.serviceRole, "SUPABASE_SERVICE_ROLE_KEY"],
          [
            "stronger fallback model",
            envSet.fallbackModel,
            "OPENAI_FALLBACK_MODEL (optional)",
          ],
          ["email sending", envSet.resend, "RESEND_API_KEY"],
        ].map(([label, set, key]) => (
          <div
            key={key as string}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="text-sm">{label as string}</p>
              <p className="font-mono text-xs text-faint">{key as string}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-ink-soft">
              {set ? "set" : "not set"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
