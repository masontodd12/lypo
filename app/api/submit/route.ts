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
    const { projectId, data } = await request.json();
    if (!projectId || !data) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400, headers: CORS },
      );
    }

    const supabase = await createClient();

    // Only accept submissions for published projects
    const { data: project } = await supabase
      .from("projects")
      .select("id, status")
      .eq("id", projectId)
      .eq("status", "published")
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );
    }

    await supabase
      .from("submissions")
      .insert({ project_id: projectId, data });

    // Email the site owner (best-effort; skipped if no key configured)
    if (process.env.RESEND_API_KEY) {
      const { data: owner } = await supabase
        .from("projects")
        .select("name, owner_email")
        .eq("id", projectId)
        .single();
      if (owner?.owner_email) {
        const rows = Object.entries(data)
          .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6f6459;">${k}</td><td style="padding:4px 0;">${String(v)}</td></tr>`)
          .join("");
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Lypo <notifications@resend.dev>",
            to: owner.owner_email,
            subject: `New response on ${owner.name}`,
            html: `<div style="font-family:sans-serif;"><h2>Someone responded on ${owner.name}</h2><table>${rows}</table><p style="color:#6f6459;font-size:13px;">View all responses in your Lypo dashboard.</p></div>`,
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch {
    return NextResponse.json(
      { error: "Bad request" },
      { status: 400, headers: CORS },
    );
  }
}
