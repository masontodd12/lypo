import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { RESEND_FROM } from "@/lib/email";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

function escapeHtml(value: unknown): string {
  const str =
    value != null && typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (!rateLimit(`${ip}:submit`, 20, 60 * 60 * 1000).ok) {
      return NextResponse.json(
        { error: "Too many requests, slow down." },
        { status: 429, headers: CORS },
      );
    }
    const raw = await request.text();
    if (raw.length > 10_000) {
      return NextResponse.json(
        { error: "Submission too large" },
        { status: 413, headers: CORS },
      );
    }
    const { projectId, data } = JSON.parse(raw);
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
        // Submissions come from an open endpoint, so field names and values
        // are attacker-controlled. Escape before they go anywhere near the
        // owner's inbox.
        const rows = Object.entries(data)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#6f6459;">${escapeHtml(k)}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`,
          )
          .join("");
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: owner.owner_email,
            subject: `New response on ${owner.name}`,
            html: `<div style="font-family:sans-serif;"><h2>Someone responded on ${escapeHtml(owner.name)}</h2><table>${rows}</table><p style="color:#6f6459;font-size:13px;">View all responses in your Lypo dashboard.</p></div>`,
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
