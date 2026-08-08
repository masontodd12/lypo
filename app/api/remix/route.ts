import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { projectAllowance, uniqueName } from "@/lib/limits";
import { isAdmin } from "@/lib/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to remix" }, { status: 401 });
  }

  // A remix creates a new project, so it draws from the same allowance.
  const allowance = await projectAllowance(supabase, user.id, {
    unlimited: isAdmin(user),
  });
  if (allowance.reached) {
    return NextResponse.json(
      {
        error: `You've started ${allowance.limit} sites this month. Your next one unlocks ${allowance.resetsOn}.`,
      },
      { status: 429 },
    );
  }

  const { projectId } = await request.json();
  const { data: source } = await supabase
    .from("projects")
    .select("name, idea, html, kind")
    .eq("id", projectId)
    .eq("status", "published")
    .single();

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: clone, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: await uniqueName(supabase, user.id, `${source.name} (remix)`),
      idea: source.idea,
      html: source.html,
      kind: source.kind,
      owner_email: user.email,
    })
    .select("id")
    .single();

  if (error || !clone) {
    return NextResponse.json({ error: error?.message ?? "Remix failed" }, { status: 500 });
  }
  return NextResponse.json({ id: clone.id });
}
