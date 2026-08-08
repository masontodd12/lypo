"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

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
