import { createClient } from "@/lib/supabase/server";
import { siteUrlFor } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Lists the home page plus every extra page of a published multi-page site. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("slug, pages, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  const pages = (project.pages ?? {}) as Record<string, string>;
  // "home" is the site root, not /home, and pages that were never written
  // would 404 for a crawler.
  const names = Object.keys(pages).filter(
    (name) => name !== "home" && typeof pages[name] === "string" && pages[name].trim() !== "",
  );
  const lastmod = new Date(project.updated_at ?? Date.now())
    .toISOString()
    .slice(0, 10);

  const urls = [siteUrlFor(slug), ...names.map((n) => siteUrlFor(slug, n))];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod></url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
