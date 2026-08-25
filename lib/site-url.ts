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

/**
 * What a slug is allowed to look like.
 *
 * Lives here rather than beside the publish route because the admin board
 * changes addresses too, and two copies of this rule would eventually
 * disagree about what is valid.
 */
export const SLUG_RULE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

/** Validates a desired address, without touching the database. */
export function checkSlug(raw: string): SlugCheck {
  const slug = String(raw ?? "").toLowerCase().trim();
  if (!SLUG_RULE.test(slug)) {
    return {
      ok: false,
      reason:
        "Links can use lowercase letters, numbers, and hyphens (3-40 characters).",
    };
  }
  // Slugs become subdomains, so platform names are off limits.
  if (RESERVED_SUBDOMAINS.has(slug)) {
    return { ok: false, reason: `"${slug}" is reserved. Try another name.` };
  }
  return { ok: true, slug };
}

/**
 * Makes a "?next=" destination safe to redirect to.
 *
 * The value arrives from the query string, so it is attacker-controlled. Fed
 * straight to new URL(next, origin) an absolute URL wins over the base and
 * "?next=https://evil.com" becomes a redirect off the site, carried out by us
 * immediately after someone signs in, which is exactly when they are least
 * likely to notice the address changed.
 *
 * Only a plain in-app path is allowed. Anything else falls back.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  const value = (raw ?? "").trim();
  // Must start with a single slash: "//evil.com" is protocol-relative and
  // would leave the site just as surely as a full URL.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  return value;
}

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
