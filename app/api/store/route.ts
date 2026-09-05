import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Ceilings for the built-in storage a generated web app can write to.
 *
 * This endpoint is public and unauthenticated by necessity: it is called by
 * visitors to a published site, who have no account. Everything below exists
 * because the only other limit is how fast someone can send requests.
 */
/** One value. Generous for a to-do list or a scoreboard, useless as a dump. */
const MAX_BODY = 32_000;
/** Distinct keys per project, so one app cannot grow rows without bound. */
const MAX_KEYS = 200;
const MAX_KEY_LENGTH = 200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (!rateLimit(`${ip}:store`, 300, 60 * 60 * 1000).ok) {
      return NextResponse.json(
        { error: "Too many requests, slow down." },
        { status: 429, headers: CORS },
      );
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return NextResponse.json(
        { error: "That is too much data to store." },
        { status: 413, headers: CORS },
      );
    }

    const { projectId, action, key, value } = JSON.parse(raw);
    if (!projectId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400, headers: CORS });
    }
    // Every action but "list" addresses one key, and an upsert with no key
    // writes a row nothing can ever read back.
    if (action !== "list") {
      if (typeof key !== "string" || !key || key.length > MAX_KEY_LENGTH) {
        return NextResponse.json(
          { error: "Missing or invalid key" },
          { status: 400, headers: CORS },
        );
      }
    }

    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("status", "published")
      .single();
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
    }

    if (action === "set") {
      // Counted before writing, so a project cannot accumulate rows for
      // ever. Existing keys stay writable at the ceiling; only genuinely
      // new ones are refused, so an app already at the limit keeps working.
      const { count } = await supabase
        .from("app_data")
        .select("key", { count: "exact", head: true })
        .eq("project_id", projectId);
      if ((count ?? 0) >= MAX_KEYS) {
        const { data: existing } = await supabase
          .from("app_data")
          .select("key")
          .eq("project_id", projectId)
          .eq("key", key)
          .maybeSingle();
        if (!existing) {
          return NextResponse.json(
            { error: "This app has stored as much as it can." },
            { status: 429, headers: CORS },
          );
        }
      }
      await supabase.from("app_data").upsert(
        { project_id: projectId, key, value, updated_at: new Date().toISOString() },
        { onConflict: "project_id,key" },
      );
      return NextResponse.json({ ok: true }, { headers: CORS });
    }
    if (action === "get") {
      const { data } = await supabase
        .from("app_data")
        .select("value")
        .eq("project_id", projectId)
        .eq("key", key)
        .maybeSingle();
      return NextResponse.json({ value: data?.value ?? null }, { headers: CORS });
    }
    if (action === "list") {
      const { data } = await supabase
        .from("app_data")
        .select("key, value")
        .eq("project_id", projectId)
        .limit(100);
      return NextResponse.json({ items: data ?? [] }, { headers: CORS });
    }
    return NextResponse.json({ error: "Bad action" }, { status: 400, headers: CORS });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: CORS });
  }
}
