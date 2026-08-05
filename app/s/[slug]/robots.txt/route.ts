import { createClient } from "@/lib/supabase/server";
import { siteUrlFor } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * robots.txt for a published site.
 *
 * On <slug>.lypo.dev the middleware rewrites /robots.txt to this route, so a
 * site gets its own file rather than the platform's. Without it, search
 * engines had nothing telling them these sites exist, which matters when the
 * site is a small business's only web presence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("slug")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  // Unpublished or deleted: ask crawlers to stay away entirely.
  const body = project
    ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrlFor(slug)}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
