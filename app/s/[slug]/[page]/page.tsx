import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublishedProject,
  pageHtmlFor,
  renderSite,
} from "@/lib/published-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  const project = await getPublishedProject({ slug });
  return {
    title: project ? `${project.name} — ${page}` : "Lypo site",
  };
}

export default async function PublicSubPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  const project = await getPublishedProject({ slug });
  const pageHtml = project ? pageHtmlFor(project, page) : null;
  if (!project || !pageHtml) notFound();

  return renderSite(project, pageHtml);
}
