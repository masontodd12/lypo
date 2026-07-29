// Canonical URL helpers.
//
// Published sites live at <slug>.lypo.dev in production. The old
// lypo.dev/s/<slug> path keeps working forever so links people already
// shared never break, but it is no longer the canonical form.

// Subdomains that can never be a site slug, because they either are or
// will be part of the platform itself.
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "auth",
  "assets",
  "blog",
  "builder",
  "cdn",
  "dashboard",
  "docs",
  "domain",
  "email",
  "gallery",
  "help",
  "login",
  "mail",
  "onboarding",
  "poster",
  "s",
  "settings",
  "static",
  "status",
  "support",
  "www2",
]);

/** Bare app host, e.g. "lypo.dev" or "localhost:3000". */
export function appHost(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lypo.dev")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

/** Full app origin, e.g. "https://lypo.dev". */
export function appOrigin(): string {
  const host = appHost();
  return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
}

/**
 * Environments where wildcard DNS does not exist, so we have to fall back
 * to path routing: local dev and Vercel preview deployments.
 */
function pathRoutingOnly(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".vercel.app")
  );
}

/**
 * The canonical public URL for a published site.
 * Production: https://my-fundraiser.lypo.dev
 * Local/preview: http://localhost:3000/s/my-fundraiser
 */
export function siteUrlFor(slug: string, page?: string): string {
  const host = appHost();
  const suffix = page && page !== "home" ? `/${page}` : "";
  if (pathRoutingOnly(host)) {
    return `${appOrigin()}/s/${slug}${suffix}`;
  }
  return `https://${slug}.${host}${suffix}`;
}

/** Same as siteUrlFor but without the scheme, for display in the UI. */
export function siteUrlLabel(slug: string): string {
  return siteUrlFor(slug).replace(/^https?:\/\//, "");
}
