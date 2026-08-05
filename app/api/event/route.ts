import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/** Kept in step with the check inside increment_site_event. */
const ALLOWED = new Set(["call", "directions", "menu", "social", "pay"]);

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/**
 * Records that a visitor tapped something meaningful on a published site.
 * A view count alone does not tell an owner whether the site is working;
 * taps on the phone number are what say someone is about to walk in.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (!rateLimit(`${ip}:event`, 120, 60 * 60 * 1000).ok) {
      // Silently accepted so a rate-limited visitor never sees an error on
      // someone's site over an analytics ping.
      return NextResponse.json({ ok: true }, { headers: CORS });
    }

    const body = await request.json();
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const event = typeof body?.event === "string" ? body.event : "";

    if (!projectId || !ALLOWED.has(event)) {
      return NextResponse.json(
        { error: "Bad request" },
        { status: 400, headers: CORS },
      );
    }

    const supabase = await createClient();
    await supabase.rpc("increment_site_event", { pid: projectId, ev: event });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    // Analytics must never break a visitor's experience.
    return NextResponse.json({ ok: true }, { headers: CORS });
  }
}
