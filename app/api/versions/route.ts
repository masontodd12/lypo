import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/versions?projectId=...&page=home  -> list (no html, keeps it light)
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const page = url.searchParams.get("page") ?? "home";
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: versions } = await supabase
    .from("project_versions")
    .select("id, summary, created_at")
    .eq("project_id", projectId)
    .eq("page", page)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ versions: versions ?? [] });
}

// POST /api/versions { projectId, versionId }  -> restore
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, versionId } = await request.json();
  if (!projectId || !versionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, pages, html")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: version } = await supabase
    .from("project_versions")
    .select("id, page, html, summary")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .single();
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const pagesMap: Record<string, string> =
    project.pages && typeof project.pages === "object"
      ? { ...(project.pages as Record<string, string>) }
      : project.html
      ? { home: project.html }
      : {};
  pagesMap[version.page] = version.html;

  const { error } = await supabase
    .from("projects")
    .update({
      pages: pagesMap,
      html: pagesMap.home ?? version.html,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Restoring is itself a change worth being able to undo
  await supabase.from("project_versions").insert({
    project_id: projectId,
    page: version.page,
    html: version.html,
    summary: `Restored: ${version.summary ?? "earlier version"}`,
  });

  return NextResponse.json({
    html: version.html,
    page: version.page,
    summary: version.summary,
  });
}
