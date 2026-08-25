import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkSlug } from "@/lib/site-url";

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
    const check = checkSlug(String(desiredSlug));
    if (!check.ok) {
      return NextResponse.json(
        { error: check.reason },
        { status: check.reason.includes("reserved") ? 409 : 400 },
      );
    }
    const cleaned = check.slug;
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
    // The check above can lose a race with another publish, so the unique
    // index is the real guarantee. Report it as the taken link it is rather
    // than a database error.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That link was just taken, try another." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slug });
}
