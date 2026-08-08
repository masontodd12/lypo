import { createAdminClient } from "@/lib/supabase/admin";
import { MONTHLY_PROJECT_LIMIT, monthStart } from "@/lib/limits";
import { GrantForm } from "./GrantForm";

export const dynamic = "force-dynamic";

type Row = {
  userId: string;
  email: string;
  thisMonth: number;
  total: number;
  published: number;
  grant: number;
  note: string;
};

export default async function AdminUsage() {
  const db = createAdminClient();
  const since = monthStart().toISOString();

  const [{ data: projects }, { data: grants }, { data: usage }] =
    await Promise.all([
      db
        .from("projects")
        .select("user_id, owner_email, status, created_at")
        .is("deleted_at", null),
      db.from("project_grants").select("user_id, extra_projects, note"),
      db
        .from("usage")
        .select("user_id, day, count")
        .gte("day", since.slice(0, 10)),
    ]);

  const byUser = new Map<string, Row>();
  for (const p of projects ?? []) {
    const id = p.user_id as string;
    if (!id) continue;
    const row =
      byUser.get(id) ??
      ({
        userId: id,
        email: p.owner_email ?? "unknown",
        thisMonth: 0,
        total: 0,
        published: 0,
        grant: 0,
        note: "",
      } satisfies Row);
    row.total += 1;
    if (p.status === "published") row.published += 1;
    if (p.created_at && p.created_at >= since) row.thisMonth += 1;
    if (p.owner_email) row.email = p.owner_email;
    byUser.set(id, row);
  }
  for (const g of grants ?? []) {
    const row = byUser.get(g.user_id as string);
    if (row) {
      row.grant = g.extra_projects ?? 0;
      row.note = g.note ?? "";
    }
  }

  const rows = [...byUser.values()].sort((a, b) => b.thisMonth - a.thisMonth);

  // Generations, not projects: the usage table counts every build and edit.
  const edits = (usage ?? []).reduce((n, u) => n + (u.count ?? 0), 0);
  const byDay = new Map<string, number>();
  for (const u of usage ?? []) {
    const d = String(u.day).slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + (u.count ?? 0));
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const peak = Math.max(1, ...days.map(([, n]) => n));

  return (
    <section className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        usage<span className="text-flame">.</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {rows.length} account{rows.length === 1 ? "" : "s"} ·{" "}
        {edits.toLocaleString()} generation{edits === 1 ? "" : "s"} this month.
        Each generation is one build or one edit, which is what costs money.
      </p>

      {days.length > 0 && (
        <div className="mt-6 rounded-xl border border-line bg-paper p-4">
          <div className="flex h-20 items-end gap-1" aria-hidden="true">
            {days.map(([day, n]) => (
              <div
                key={day}
                title={`${day}: ${n}`}
                className="flex-1 rounded-t-sm bg-flame/70"
                style={{ height: `${Math.max(3, (n / peak) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            generations per day this month, peak {peak}
          </p>
        </div>
      )}

      <h2 className="font-display mt-10 text-lg font-semibold tracking-tight">
        accounts
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Everyone gets {MONTHLY_PROJECT_LIMIT} new sites a month. Extra sites
        raise that for one account only, without making them an admin.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">No accounts yet.</p>
      ) : (
        <div className="mt-4 divide-y divide-line rounded-xl border border-line">
          {rows.map((r) => (
            <div
              key={r.userId}
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{r.email}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {r.thisMonth} of {MONTHLY_PROJECT_LIMIT + r.grant} this month
                  · {r.total} total · {r.published} published
                  {r.note && ` · ${r.note}`}
                </p>
              </div>
              <GrantForm
                userId={r.userId}
                email={r.email}
                current={r.grant}
                note={r.note}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
