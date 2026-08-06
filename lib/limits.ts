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
