import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SLUG_RULE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, desiredSlug, story } = await request.json();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, html, status")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.html) {
    return NextResponse.json(
      { error: "Build something before publishing." },
      { status: 400 },
    );
  }

  let slug = project.slug;

  if (desiredSlug) {
    const cleaned = String(desiredSlug).toLowerCase().trim();
    if (!SLUG_RULE.test(cleaned)) {
      return NextResponse.json(
        {
          error:
            "Links can use lowercase letters, numbers, and hyphens (3-40 characters).",
        },
        { status: 400 },
      );
    }
    // Is it taken by someone else?
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", cleaned)
      .neq("id", projectId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "That link is taken — try another." },
        { status: 409 },
      );
    }
    slug = cleaned;
  }

  if (!slug) {
    return NextResponse.json(
      { error: "Pick a link name for your site." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("projects")
    .update({ slug, status: "published", ...(story ? { story } : {}) })
    .eq("id", projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slug });
}
