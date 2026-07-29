import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import { siteUrlFor, appOrigin } from "@/lib/site-url";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_RECIPIENTS = 200;

// POST /api/broadcast { projectId, subject, body }
// Emails everyone who submitted a form response containing an email address.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email isn't configured on this server." },
      { status: 500 },
    );
  }

  const { projectId, subject, body } = await request.json();
  if (!projectId || !subject?.trim() || !body?.trim()) {
    return NextResponse.json(
      { error: "Write a subject and a message first." },
      { status: 400 },
    );
  }
  if (String(subject).length > 150 || String(body).length > 5000) {
    return NextResponse.json({ error: "Message too long." }, { status: 413 });
  }

  // 3 broadcasts per project per day: enough for real updates, hostile to spam
  if (!rateLimit(`${projectId}:broadcast`, 3, 24 * 60 * 60 * 1000).ok) {
    return NextResponse.json(
      { error: "Limit reached: 3 messages per day per site." },
      { status: 429 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, name, slug, owner_email")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("data")
    .eq("project_id", projectId)
    .limit(1000);

  // Find email addresses anywhere in the response data
  const recipients = Array.from(
    new Set(
      (submissions ?? [])
        .flatMap((s) =>
          s.data && typeof s.data === "object"
            ? Object.values(s.data as Record<string, unknown>)
            : [],
        )
        .map((v) => String(v ?? "").trim().toLowerCase())
        .filter((v) => EMAIL_RE.test(v)),
    ),
  ).slice(0, MAX_RECIPIENTS);

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No email addresses found in your responses yet." },
      { status: 400 },
    );
  }

  const siteUrl = project.slug ? siteUrlFor(project.slug) : appOrigin();
  const safeBody = String(body)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#221C17;">
  <p style="white-space:normal;line-height:1.6;">${safeBody}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="font-size:12px;color:#6f6459;">
    Sent by the organizer of <a href="${siteUrl}" style="color:#E8542F;">${project.name}</a>.
    You're receiving this because you responded on their site.
  </p>
</div>`;

  // Send individually so recipients never see each other's addresses
  let sent = 0;
  for (const to of recipients) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Lypo <notifications@resend.dev>",
        to,
        ...(project.owner_email ? { reply_to: project.owner_email } : {}),
        subject: String(subject).trim(),
        html,
      }),
    }).catch(() => null);
    if (res?.ok) sent += 1;
  }

  return NextResponse.json({ sent, total: recipients.length });
}
