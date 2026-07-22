import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { ProjectCard } from "@/components/ProjectCard";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, html, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

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
        <div className="flex items-end justify-between">
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            your projects<span className="text-flame">.</span>
          </h1>
          <div className="flex items-center gap-6 text-sm">
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
            <Link
              href="/onboarding"
              className="border-b-2 border-ink pb-1 font-medium transition hover:border-flame hover:text-flame"
            >
              new project →
            </Link>
          </div>
        </div>

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
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
