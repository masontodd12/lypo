import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RestoreButton } from "@/components/RestoreButton";

export default async function Archive() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Purge anything archived more than 30 days ago
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("projects").delete().lt("deleted_at", cutoff);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  function daysLeft(deletedAt: string) {
    const gone = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((gone - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  return (
    <main className="mx-auto max-w-6xl px-6">
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
          ← back to projects
        </Link>
      </header>

      <section className="py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          archive<span className="text-flame">.</span>
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Deleted projects stay here for 30 days, then they&apos;re gone for
          good.
        </p>

        {!projects || projects.length === 0 ? (
          <p className="mt-10 text-ink-soft">
            Nothing in the archive. When you delete a project, it&apos;ll live
            here for 30 days in case you change your mind.
          </p>
        ) : (
          <div className="mt-8 divide-y divide-line rounded-xl border border-line">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-display font-semibold">{project.name}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {daysLeft(project.deleted_at!)} days left
                  </p>
                </div>
                <RestoreButton id={project.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}