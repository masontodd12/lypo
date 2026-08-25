import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderChat } from "@/components/BuilderChat";
import { PublishButton } from "@/components/PublishButton";
import {
  ThemeToggle,
  BuilderTheme,
  THEME_INIT_SCRIPT,
} from "@/components/ThemeToggle";
import { appHost } from "@/lib/site-url";

export default async function Builder({
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
    .select("id, name, idea, html, slug, status, messages, kind, payments_enabled, pages, multi_page, logo_url")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: stripeAccount } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const stripeConnected = !!stripeAccount?.account_id;

  // Fetched on its own so the builder still loads on a database that has not
  // had the onboarding_draft migration applied yet. Selecting a column that
  // does not exist fails the whole row, which would 404 the page.
  const { data: draftRow } = await supabase
    .from("projects")
    .select("onboarding_draft")
    .eq("id", id)
    .maybeSingle();

  // Same reason, separately again: this column arrives with its own
  // migration, and a builder that 404s because of it would be worse than one
  // that simply shows the domain controls. Anything but an explicit false is
  // allowed, so an un-migrated database behaves like an open one.
  let customDomainAllowed = true;
  try {
    const { data } = await supabase
      .from("projects")
      .select("custom_domain_allowed")
      .eq("id", id)
      .maybeSingle();
    customDomainAllowed = data?.custom_domain_allowed !== false;
  } catch {
    // Not migrated yet: everyone can connect one.
  }

  return (
    <main className="flex h-screen flex-col">
      {/* Runs before the builder paints, so opening it in dark mode does not
          flash white. Only the builder is themeable, so this stays here
          rather than in the root layout where it would ship on every
          marketing page and never do anything. BuilderTheme then covers
          client-side navigation into the builder. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <BuilderTheme />
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          {/* The wordmark already goes back to the dashboard, so on a phone
              it stands in for the separate "projects" link. */}
          <Link
            href="/dashboard"
            className="font-display shrink-0 text-sm font-semibold tracking-[0.3em] sm:tracking-[0.4em]"
          >
            LYPO<span className="text-flame">.</span>
          </Link>
          <Link
            href="/dashboard"
            className="hidden shrink-0 text-sm text-faint transition hover:text-flame sm:block"
          >
            ← projects
          </Link>
          <span className="truncate text-sm text-ink-soft sm:max-w-[16rem]">
            {project.name}
          </span>
          <Link
            href={`/builder/${id}/responses`}
            className="hidden shrink-0 text-sm text-ink-soft transition hover:text-flame sm:block"
          >
            responses
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <PublishButton
            projectId={project.id}
            initialSlug={project.slug}
            initialStatus={project.status}
            appHost={appHost()}
            pathRouting={
              appHost().startsWith("localhost") ||
              appHost().endsWith(".vercel.app")
            }
          />
        </div>
      </header>

      <BuilderChat
        initialPages={project.pages ?? null}
        initialMultiPage={project.multi_page ?? false}
        projectId={project.id}
        initialIdea={project.idea}
        initialHtml={project.html}
        initialMessages={
          Array.isArray(project.messages) ? project.messages : []
        }
        initialName={project.name}
        initialKind={project.kind}
        initialLogo={project.logo_url ?? null}
        initialPaymentsEnabled={project.payments_enabled ?? false}
        stripeConnected={stripeConnected}
        initialDraft={draftRow?.onboarding_draft ?? null}
        initialStatus={project.status}
        customDomainAllowed={customDomainAllowed}
      />
    </main>
  );
}
