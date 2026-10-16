import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUBSCRIPTIONS_ENABLED, isLive, syncOwnerSites } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Daily reconcile between who is paying and which sites are up.
 *
 * The webhook does this as it happens. This catches what it cannot: a missed
 * or failed delivery, sites that were published before the switch was turned
 * on, and turning the switch off, which puts every suspended site back.
 * Triggered by Vercel cron (see vercel.json). Guarded by CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: projects, error } = await db
    .from("projects")
    .select("user_id")
    .in("status", ["published", "suspended"])
    .is("deleted_at", null)
    .not("user_id", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const owners = [...new Set((projects ?? []).map((p) => p.user_id as string))];
  if (owners.length === 0) return NextResponse.json({ owners: 0 });

  const { data: subs } = await db
    .from("subscriptions")
    .select("user_id, status")
    .in("user_id", owners);
  const status = new Map((subs ?? []).map((s) => [s.user_id, s.status]));

  for (const owner of owners) {
    await syncOwnerSites(
      db,
      owner,
      !SUBSCRIPTIONS_ENABLED || isLive(status.get(owner)),
    );
  }

  return NextResponse.json({ owners: owners.length });
}
