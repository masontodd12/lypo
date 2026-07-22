import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string }>;
}) {
  const { idea } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const params = new URLSearchParams({ next: "/onboarding" });
    if (idea) params.set("idea", idea);
    redirect(`/login?${params.toString()}`);
  }

  const name = idea
    ? idea.slice(0, 40).replace(/\s+\S*$/, "") || "untitled"
    : "untitled";

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, idea: idea ?? null, owner_email: user.email })
    .select("id")
    .single();

  if (error || !project) redirect("/dashboard");

  redirect(`/builder/${project.id}`);
}
