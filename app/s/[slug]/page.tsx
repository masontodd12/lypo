import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  extractMeta,
  getPublishedProject,
  pageHtmlFor,
  renderSite,
} from "@/lib/published-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject({ slug });
  const { description, image } = extractMeta(
    project ? pageHtmlFor(project, "home") : null,
  );
  const title = project?.name ?? "Lypo site";
  return {
    title,
    description: description ?? undefined,
    manifest: project ? `/api/manifest/${project.project_id}` : undefined,
    themeColor: "#e8542f",
    openGraph: {
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
      type: "website",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicSite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getPublishedProject({ slug });
  const pageHtml = project ? pageHtmlFor(project, "home") : null;
  if (!project || !pageHtml) notFound();

  return renderSite(project, pageHtml);
}
