import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BroadcastForm } from "@/components/BroadcastForm";
import { LocalTime } from "@/components/LocalTime";
import { SiteStats } from "@/components/SiteStats";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// /api/submit is a public endpoint that stores whatever JSON it is given,
// so a value here can be an object or array. React throws on those, which
// would take the whole page down, so flatten anything non-primitive.
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function Responses({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("id", id)
    .single();
  if (!project) notFound();

  // Both tables are best-effort: a database that has not run the analytics
  // migrations should still render the responses table.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDay = since.toISOString().slice(0, 10);

  const [{ data: viewRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("site_views")
      .select("day, count")
      .eq("project_id", id)
      .gte("day", sinceDay),
    supabase
      .from("site_events")
      .select("event, count")
      .eq("project_id", id)
      .gte("day", sinceDay),
  ]);

  const taps: Record<string, number> = {};
  for (const e of eventRows ?? []) {
    taps[e.event] = (taps[e.event] ?? 0) + (e.count ?? 0);
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, data, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const columns = Array.from(
    new Set(
      (submissions ?? []).flatMap((s) =>
        s.data && typeof s.data === "object" ? Object.keys(s.data) : [],
      ),
    ),
  );

  const emailCount = new Set(
    (submissions ?? [])
      .flatMap((s) =>
        s.data && typeof s.data === "object"
          ? Object.values(s.data as Record<string, unknown>)
          : [],
      )
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter((v) => EMAIL_RE.test(v)),
  ).size;

  return (
    <main className="mx-auto max-w-6xl px-6">
      <header className="flex items-center justify-between border-b border-line py-5">
        <div className="flex items-center gap-5">
          <Link
            href={`/builder/${id}`}
            className="font-display text-sm font-semibold tracking-[0.4em]"
          >
            LYPO<span className="text-flame">.</span>
          </Link>
          <span className="text-sm text-ink-soft">{project.name} · responses</span>
        </div>
        <Link
          href={`/builder/${id}`}
          className="text-sm font-medium transition hover:text-flame"
        >
          ← back to builder
        </Link>
      </header>

      <section className="py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          responses<span className="text-flame">.</span>
        </h1>
        <div className="mt-2 flex items-center gap-4">
          <p className="text-sm text-ink-soft">{submissions?.length ?? 0} total</p>
          {submissions && submissions.length > 0 && (
            <a
              href={`/api/export/${id}`}
              className="text-sm font-medium text-flame transition hover:underline"
            >
              download csv
            </a>
          )}
        </div>

        <SiteStats
          views={(viewRows ?? []).map((v) => ({
            day: String(v.day),
            count: v.count ?? 0,
          }))}
          taps={taps}
          published={project.status === "published"}
        />

        <BroadcastForm projectId={id} emailCount={emailCount} />

        {!submissions || submissions.length === 0 ? (
          <p className="mt-10 text-ink-soft">
            No responses yet. Once your site is published and someone fills out
            a form, their answers show up here.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist/60 text-xs tracking-widest text-faint uppercase">
                <tr>
                  <th className="px-4 py-3">when</th>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-faint">
                      <LocalTime iso={s.created_at} />
                    </td>
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-3">
                        {cellText(s.data?.[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
