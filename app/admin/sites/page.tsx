import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrlFor } from "@/lib/site-url";
import { SiteRow, type AdminSite } from "./SiteRow";

export const dynamic = "force-dynamic";

export default async function AdminSites({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = createAdminClient();

  // Service role, because RLS scopes normal reads to the signed-in owner and
  // this page exists precisely to see across accounts.
  const { data, error } = await db
    .from("projects")
    .select(
      "id, name, slug, status, featured, owner_email, updated_at, custom_domain, custom_domain_allowed",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  const term = (q ?? "").trim().toLowerCase();
  const sites: AdminSite[] = (data ?? [])
    .filter(
      (p) =>
        !term ||
        (p.name ?? "").toLowerCase().includes(term) ||
        (p.slug ?? "").toLowerCase().includes(term) ||
        (p.owner_email ?? "").toLowerCase().includes(term),
    )
    .map((p) => ({
      id: p.id,
      name: p.name ?? "untitled",
      slug: p.slug,
      status: p.status,
      featured: p.featured ?? false,
      ownerEmail: p.owner_email ?? null,
      liveUrl:
        p.status === "published" && p.slug ? siteUrlFor(p.slug) : null,
      updatedAt: p.updated_at ?? null,
      customDomain: p.custom_domain ?? null,
      customDomainAllowed: p.custom_domain_allowed ?? false,
    }));

  const published = sites.filter((s) => s.status === "published").length;
  const featured = sites.filter((s) => s.featured).length;
  const onOwnDomain = sites.filter((s) => s.customDomain).length;

  return (
    <section className="py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        sites<span className="text-flame">.</span>
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {sites.length} project{sites.length === 1 ? "" : "s"} · {published}{" "}
        published · {featured} featured in the gallery · {onOwnDomain} on their
        own domain
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-flame/40 bg-flame/5 p-4 text-sm">
          Couldn&apos;t load projects: {error.message}
          {/* Selecting a column that does not exist fails the whole query,
              so a missing migration takes the board down rather than one
              control. Naming it is the difference between a five-second fix
              and an afternoon. */}
          {(error.message.includes("featured") ||
            error.message.includes("custom_domain_allowed")) &&
            " Run supabase-migration.sql to add the missing column."}
        </div>
      )}

      <form className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="search by name, address, or owner email"
          aria-label="Search sites"
          className="w-full max-w-md rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-flame"
        />
      </form>

      {sites.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          {term ? "Nothing matches that." : "No projects yet."}
        </p>
      ) : (
        <div className="mt-6 divide-y divide-line rounded-xl border border-line">
          {sites.map((s) => (
            <SiteRow key={s.id} site={s} />
          ))}
        </div>
      )}
    </section>
  );
}
