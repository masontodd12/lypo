import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findGaps } from "@/lib/clarify";

/** Long enough for one small model call, short enough not to stall a build. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ questions: [] }, { status: 401 });

  const { description, purpose, pages } = await request.json();

  const questions = await findGaps(
    String(description ?? ""),
    typeof purpose === "string" ? purpose : null,
    Array.isArray(pages) ? pages.filter((p) => typeof p === "string") : [],
  );

  return NextResponse.json({ questions });
}
