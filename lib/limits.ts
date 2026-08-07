import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How many new sites one account can start per calendar month.
 *
 * Editing an existing site is deliberately not capped: someone should be
 * able to keep working on their site until it is right without watching a
 * counter. The cost that needed a ceiling is people spinning up sites
 * endlessly, not people finishing one.
 */
export const MONTHLY_PROJECT_LIMIT = 5;

/** First instant of the current calendar month, UTC. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the allowance resets, worded for a person. */
export function resetsOnLabel(now = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return next.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Is this name already used by another of the same person's projects?
 *
 * Compared case-insensitively and trimmed, so "Fade Kings" and "fade kings "
 * are the same name. Scoped to the one account on purpose: two unrelated
 * barbershops both called Fade Kings is fine and not our business, but two
 * of your own projects with the same name makes the dashboard unreadable.
 */
export async function isNameTaken(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  exceptProjectId?: string,
): Promise<boolean> {
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return false;

  // Compared in JS rather than with ilike, whose % and _ are wildcards: a
  // project called "50% off" or "fade_kings" would otherwise match names it
  // should not. Nobody has many projects, so fetching them is cheap.
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId)
    .is("deleted_at", null);

  return (data ?? []).some(
    (p) =>
      p.id !== exceptProjectId &&
      (p.name ?? "").trim().toLowerCase() === cleaned,
  );
}

/**
 * Turns a wanted name into one that is free, by adding " 2", " 3" and so on.
 * Used where a name is generated rather than typed, so onboarding never
 * stops to argue about a name the person did not choose.
 */
export async function uniqueName(
  supabase: SupabaseClient,
  userId: string,
  wanted: string,
): Promise<string> {
  const base = wanted.trim() || "untitled";
  if (!(await isNameTaken(supabase, userId, base))) return base;

  for (let n = 2; n <= 50; n++) {
    const candidate = `${base} ${n}`;
    if (!(await isNameTaken(supabase, userId, candidate))) return candidate;
  }
  // Someone has 50 of these. Fall back to something certainly free.
  return `${base} ${Date.now().toString().slice(-5)}`;
}

export type ProjectAllowance = {
  used: number;
  limit: number;
  remaining: number;
  reached: boolean;
  resetsOn: string;
};

/**
 * Counts sites started this month.
 *
 * Deleted projects still count. Otherwise the limit would be trivial to
 * sidestep by deleting and starting over, and the cost of generating them
 * has already been paid.
 */
export async function projectAllowance(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProjectAllowance> {
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart().toISOString());

  const used = count ?? 0;
  const remaining = Math.max(0, MONTHLY_PROJECT_LIMIT - used);
  return {
    used,
    limit: MONTHLY_PROJECT_LIMIT,
    remaining,
    reached: remaining === 0,
    resetsOn: resetsOnLabel(),
  };
}
