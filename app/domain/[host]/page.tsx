import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DomainSite({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("slug")
    .eq("custom_domain", host.toLowerCase())
    .eq("status", "published")
    .is("deleted_at", null)
    .single();

  if (!project?.slug) notFound();
  redirect(`/s/${project.slug}`);
}
