import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  const now = new Date();
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/gallery`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
