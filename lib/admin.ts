import type { User } from "@supabase/supabase-js";

/**
 * Who counts as an admin.
 *
 * Set LYPO_ADMIN_EMAILS to a comma-separated list, for example
 * "you@example.com, teammate@example.com". Note it is NOT prefixed with
 * NEXT_PUBLIC_, so it is never sent to the browser and cannot be read or
 * edited by anyone using the site.
 */
function adminEmails(): string[] {
  return (process.env.LYPO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether this signed-in user is an admin.
 *
 * Deliberately based on the email on the verified session and an
 * environment list, never on anything the client can influence.
 *
 * In particular this must never read user_metadata: Supabase lets a signed-in
 * user write their own user_metadata through updateUser, so trusting it would
 * let anybody make themselves an admin. app_metadata would be safe, but the
 * env list needs no migration and no service-role key to manage.
 */
export function isAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return adminEmails().includes(email);
}
