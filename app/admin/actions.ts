"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { checkSlug } from "@/lib/site-url";
import { removeDomain } from "@/lib/vercel-domains";

/** Actions that can fail report why, rather than throwing at the UI. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every action re-checks admin status server-side.
 *
 * The layout gate only controls what renders. A server action is a callable
 * endpoint, so anyone who learns its id could invoke it directly; the check
 * has to live here too, not just around the page.
 */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) throw new Error("Not allowed");
  return user!;
}

/** Takes a published site offline. The project and its content are kept. */
export async function unpublishSite(projectId: string) {
  await assertAdmin();
  const db = createAdminClient();
  await db
    .from("projects")
    .update({ status: "draft", featured: false })
    .eq("id", projectId);
  revalidatePath("/admin/sites");
}

/** Shows or hides a real published site in the public gallery. */
export async function setFeatured(projectId: string, featured: boolean) {
  await assertAdmin();
  const db = createAdminClient();
  await db.from("projects").update({ featured }).eq("id", projectId);
  revalidatePath("/admin/sites");
  revalidatePath("/gallery");
}

/**
 * Frees a slug so someone else can use it.
 *
 * Clearing the address also unpublishes, because a published row with no
 * slug has no address to serve and would otherwise be unreachable and
 * invisible rather than simply offline.
 */
export async function releaseSlug(projectId: string) {
  await assertAdmin();
  const db = createAdminClient();
  await db
    .from("projects")
    .update({ slug: null, status: "draft", featured: false })
    .eq("id", projectId);
  revalidatePath("/admin/sites");
}

/** Gives one account extra sites this month without making them an admin. */
export async function setGrant(
  userId: string,
  extraProjects: number,
  note: string,
) {
  await assertAdmin();
  const db = createAdminClient();
  const extra = Math.max(0, Math.min(500, Math.round(extraProjects)));
  await db.from("project_grants").upsert(
    {
      user_id: userId,
      extra_projects: extra,
      note: note.slice(0, 200) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  revalidatePath("/admin/usage");
}

/** Renames a project. This is the name the owner sees, not its address. */
export async function renameSite(
  projectId: string,
  name: string,
): Promise<ActionResult> {
  await assertAdmin();
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "A name cannot be empty." };

  const db = createAdminClient();
  const { error } = await db
    .from("projects")
    .update({ name: clean })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath("/gallery");
  return { ok: true };
}

/**
 * Changes the address a published site is served at.
 *
 * This breaks every link anyone has already shared, which is why it is an
 * admin action rather than something an owner can do casually. The same
 * validation the publish route uses applies here, so an admin cannot hand
 * out a reserved subdomain by hand.
 */
export async function changeSlug(
  projectId: string,
  slug: string,
): Promise<ActionResult> {
  await assertAdmin();
  const check = checkSlug(slug);
  if (!check.ok) return { ok: false, error: check.reason };

  const db = createAdminClient();
  const { data: taken } = await db
    .from("projects")
    .select("id")
    .eq("slug", check.slug)
    .neq("id", projectId)
    .maybeSingle();
  if (taken) return { ok: false, error: "That address is already taken." };

  const { error } = await db
    .from("projects")
    .update({ slug: check.slug })
    .eq("id", projectId);
  if (error) {
    // The check above can lose a race, so the unique index is the real
    // guarantee. Report it as the taken address it is.
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That address was just taken."
          : error.message,
    };
  }

  revalidatePath("/admin/sites");
  return { ok: true };
}

/**
 * Archives a site the way its owner would.
 *
 * It lands in the owner's archive, restorable for thirty days, and is purged
 * from there on the usual schedule. Preferred over deleting outright: almost
 * every reason to remove a site from this board is one where being wrong
 * should be recoverable.
 */
export async function archiveSite(projectId: string): Promise<ActionResult> {
  await assertAdmin();
  const db = createAdminClient();

  // Anything attached to the wider platform has to be let go first, or the
  // site keeps a live domain and a gallery slot while sitting in a bin.
  await releaseDomain(projectId);
  const { error } = await db
    .from("projects")
    .update({
      deleted_at: new Date().toISOString(),
      status: "draft",
      featured: false,
    })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath("/gallery");
  return { ok: true };
}

/**
 * Deletes a site permanently, with no archive and no undo.
 *
 * For spam and abuse, where leaving the content sitting in someone's archive
 * for a month is the wrong answer. Everything hanging off the project goes
 * with it, so anything without a cascade has to be cleared by hand here.
 */
export async function deleteSiteForever(
  projectId: string,
): Promise<ActionResult> {
  await assertAdmin();
  const db = createAdminClient();

  await releaseDomain(projectId);

  // Best-effort, and deliberately unchecked: a table that does not exist on
  // this database yet, or one a cascade has already emptied, must not stop
  // the project row itself from going.
  for (const table of [
    "project_versions",
    "site_views",
    "site_events",
    "submissions",
  ]) {
    await db.from(table).delete().eq("project_id", projectId);
  }

  const { error } = await db.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sites");
  revalidatePath("/gallery");
  return { ok: true };
}

/**
 * Lets one site connect its own domain, or takes that permission away.
 *
 * Custom domains are handed out per site rather than to everyone: each one
 * is a real domain registered against the Vercel project, so the number of
 * them is a thing worth deciding rather than a thing that happens.
 *
 * Revoking also disconnects whatever domain is attached. Leaving it live
 * while hiding the controls would mean nobody, owner or admin, could see or
 * remove it from inside Lypo.
 */
export async function setCustomDomainAllowed(
  projectId: string,
  allowed: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  const db = createAdminClient();

  if (!allowed) await releaseDomain(projectId);

  const { error } = await db
    .from("projects")
    .update({ custom_domain_allowed: allowed })
    .eq("id", projectId);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("custom_domain_allowed")
        ? "Run supabase-migration.sql to add the custom_domain_allowed column."
        : error.message,
    };
  }

  revalidatePath("/admin/sites");
  return { ok: true };
}

/**
 * Detaches a project's custom domain from both Lypo and Vercel.
 *
 * Shared by every path that takes a site away from the public, so a removed
 * site never leaves a domain pointing at the project with a certificate
 * still being renewed for it.
 */
async function releaseDomain(projectId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("projects")
    .select("custom_domain")
    .eq("id", projectId)
    .maybeSingle();

  const domain = data?.custom_domain as string | null | undefined;
  if (!domain) return;

  try {
    await removeDomain(domain);
  } catch {
    // Vercel may not know it, or the token may be unset. The row still has
    // to be cleared either way, or nobody can reuse the domain.
  }
  await db
    .from("projects")
    .update({ custom_domain: null })
    .eq("id", projectId);
}
