import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/site-url";

// Only applies to the platform host. Published sites on their own subdomain
// or custom domain are served their own robots.txt, see
// app/s/[slug]/robots.txt/route.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind a login is useful in an index, and crawling the
      // builder would burn generation quota on pages no one can reach.
      disallow: ["/api/", "/builder/", "/dashboard/", "/settings", "/auth/"],
    },
    sitemap: `${appOrigin()}/sitemap.xml`,
  };
}
