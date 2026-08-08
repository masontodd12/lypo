import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { ProjectCard } from "@/components/ProjectCard";
import { siteUrlFor } from "@/lib/site-url";
import { projectAllowance } from "@/lib/limits";
import { isAdmin } from "@/lib/admin";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const { limit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, html, slug, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // Total views per project (RLS limits this to the user's own sites)
  const viewsByProject: Record<string, number> = {};
  if (projects && projects.length > 0) {
    const { data: views } = await supabase
      .from("site_views")
      .select("project_id, count")
      .in("project_id", projects.map((p) => p.id));
    for (const v of views ?? []) {
      viewsByProject[v.project_id] =
        (viewsByProject[v.project_id] ?? 0) + (v.count ?? 0);
    }
  }

  const allowance = await projectAllowance(supabase, user.id, {
    unlimited: isAdmin(user),
  });
  const total = projects?.length ?? 0;
  const publishedCount =
    projects?.filter((p) => p.status === "published").length ?? 0;
  const totalViews = Object.values(viewsByProject).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-6xl px-6">
      <header className="flex items-start justify-between pt-8">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.4em]"
        >
          LYPO<span className="text-flame">.</span>
        </Link>
        <div className="text-right text-sm">
          <p className="text-faint">{user.email}</p>
          <SignOutButton />
        </div>
      </header>

      <section className="pt-20 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-semibold tracking-tight">
              your projects<span className="text-flame">.</span>
            </h1>
            {total > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                {total} project{total === 1 ? "" : "s"}
                {publishedCount > 0 && `, ${publishedCount} published`}
                {totalViews > 0 &&
                  ` · ${totalViews.toLocaleString()} view${totalViews === 1 ? "" : "s"} in total`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            {isAdmin(user) && (
              <Link
                href="/admin"
                className="font-medium text-flame transition hover:underline"
              >
                admin
              </Link>
            )}
            <Link
              href="/settings"
              className="text-faint transition hover:text-flame"
            >
              settings
            </Link>
            <Link
              href="/dashboard/archive"
              className="text-faint transition hover:text-flame"
            >
              archive
            </Link>
            {allowance.reached ? (
              <span
                title={`Resets ${allowance.resetsOn}`}
                className="border-b-2 border-line pb-1 font-medium text-faint"
              >
                new project
              </span>
            ) : (
              <Link
                href="/onboarding"
                className="border-b-2 border-ink pb-1 font-medium transition hover:border-flame hover:text-flame"
              >
                new project →
              </Link>
            )}
          </div>
        </div>

        {/* Someone bounced off the cap on their way into onboarding. */}
        {limit === "projects" && allowance.reached && (
          <div className="mt-8 rounded-xl border border-flame/40 bg-flame/5 p-5">
            <p className="font-display text-sm font-semibold tracking-tight">
              that is {allowance.limit} sites this month
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              You can start another on {allowance.resetsOn}. Until then you can
              keep editing and publishing everything you have already built,
              with no limit on changes.
            </p>
          </div>
        )}

        {/* Quiet until it matters, so it reads as a heads-up, not a paywall. */}
        {!allowance.unlimited && !allowance.reached && allowance.remaining <= 2 && (
          <p className="mt-6 text-sm text-ink-soft">
            {allowance.remaining} new site{allowance.remaining === 1 ? "" : "s"}{" "}
            left this month. Resets {allowance.resetsOn}. Editing what you have
            is unlimited.
          </p>
        )}

        {!projects || projects.length === 0 ? (
          <div className="mt-16 max-w-md">
            <p className="text-lg text-ink-soft">
              Nothing here yet. Your first build is one sentence away.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-block border-b-2 border-ink pb-1 font-medium transition hover:border-flame hover:text-flame"
            >
              start building →
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                status={project.status}
                html={project.html}
                views={viewsByProject[project.id] ?? 0}
                liveUrl={
                  project.status === "published" && project.slug
                    ? siteUrlFor(project.slug)
                    : null
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
