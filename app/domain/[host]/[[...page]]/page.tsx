import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  extractMeta,
  getPublishedProject,
  pageHtmlFor,
  renderSite,
} from "@/lib/published-site";

export const dynamic = "force-dynamic";

/**
 * A site served on its owner's own domain.
 *
 * This used to redirect to /s/<slug>, which was broken two ways: the
 * redirect bounced the visitor onto lypo.dev, defeating the point of paying
 * for a domain, and because middleware rewrites every non-platform path on a
 * custom domain back here, /s/<slug> was rewritten to this route again and
 * redirected again, forever. It now renders in place, and the catch-all
 * segment keeps the path so multi-page sites work.
 */
async function resolve(params: Promise<{ host: string; page?: string[] }>) {
  const { host, page } = await params;
  const project = await getPublishedProject({ customDomain: host });
  // "/" is the home page; "/menu" is pages.menu. Deeper paths do not exist.
  const name = !page || page.length === 0 ? "home" : page.join("/");
  return { project, name };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string; page?: string[] }>;
}): Promise<Metadata> {
  const { project, name } = await resolve(params);
  if (!project) return { title: "Site not found" };

  const { description, image } = extractMeta(pageHtmlFor(project, name));
  const title = name === "home" ? project.name : `${project.name} — ${name}`;
  return {
    title,
    description: description ?? undefined,
    openGraph: {
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
      type: "website",
    },
  };
}

export default async function CustomDomainSite({
  params,
}: {
  params: Promise<{ host: string; page?: string[] }>;
}) {
  const { project, name } = await resolve(params);
  const pageHtml = project ? pageHtmlFor(project, name) : null;
  if (!project || !pageHtml) notFound();

  return renderSite(project, pageHtml);
}
