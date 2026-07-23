import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderChat } from "@/components/BuilderChat";
import { PublishButton } from "@/components/PublishButton";
import { PaymentsToggle } from "@/components/PaymentsToggle";

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
    .select("id, name, idea, html, slug, status, messages, kind, payments_enabled")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: stripeAccount } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const stripeConnected = !!stripeAccount?.account_id;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-display text-sm font-semibold tracking-[0.4em]"
          >
            LYPO<span className="text-flame">.</span>
          </Link>
          <span className="text-sm text-ink-soft">{project.name}</span>
          <Link
            href={`/builder/${id}/responses`}
            className="text-sm text-ink-soft transition hover:text-flame"
          >
            responses
          </Link>
          <PaymentsToggle
            projectId={project.id}
            initialEnabled={project.payments_enabled ?? false}
            stripeConnected={stripeConnected}
          />
        </div>
        <PublishButton
          projectId={project.id}
          initialSlug={project.slug}
          initialStatus={project.status}
        />
      </header>

      <BuilderChat
        projectId={project.id}
        initialIdea={project.idea}
        initialHtml={project.html}
        initialMessages={
          Array.isArray(project.messages) ? project.messages : []
        }
        initialName={project.name}
        initialKind={project.kind}
      />
    </main>
  );
}
