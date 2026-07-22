import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { projectId, action, key, value } = await request.json();
    if (!projectId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400, headers: CORS });
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
