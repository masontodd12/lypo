import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const idea = searchParams.get("idea");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = new URL(next, origin);
      if (idea) destination.searchParams.set("idea", idea);
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
