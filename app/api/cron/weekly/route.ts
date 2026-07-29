import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrlFor, appOrigin } from "@/lib/site-url";

// Weekly stats email: "your site got 240 views, 12 responses this week."
// Triggered by Vercel cron (see vercel.json). Guarded by CRON_SECRET.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoDay = weekAgo.toISOString().slice(0, 10);
  const site = appOrigin();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, owner_email")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("owner_email", "is", null);

  if (!projects || projects.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const projectIds = projects.map((p) => p.id);

  const [{ data: views }, { data: subs }] = await Promise.all([
    supabase
      .from("site_views")
      .select("project_id, count")
      .in("project_id", projectIds)
      .gte("day", weekAgoDay),
    supabase
      .from("submissions")
      .select("project_id")
      .in("project_id", projectIds)
      .gte("created_at", weekAgo.toISOString()),
  ]);

  const viewsBy: Record<string, number> = {};
  for (const v of views ?? []) {
    viewsBy[v.project_id] = (viewsBy[v.project_id] ?? 0) + (v.count ?? 0);
  }
  const subsBy: Record<string, number> = {};
  for (const s of subs ?? []) {
    subsBy[s.project_id] = (subsBy[s.project_id] ?? 0) + 1;
  }

  // Group sites by owner email
  const byOwner: Record<string, typeof projects> = {};
  for (const p of projects) {
    if (!p.owner_email) continue;
    (byOwner[p.owner_email] ??= []).push(p);
  }

  let sent = 0;
  for (const [email, owned] of Object.entries(byOwner)) {
    const totalViews = owned.reduce((n, p) => n + (viewsBy[p.id] ?? 0), 0);
    const totalSubs = owned.reduce((n, p) => n + (subsBy[p.id] ?? 0), 0);
    // Skip completely dead weeks so the email never becomes noise
    if (totalViews === 0 && totalSubs === 0) continue;

    const rows = owned
      .map((p) => {
        const v = viewsBy[p.id] ?? 0;
        const r = subsBy[p.id] ?? 0;
        const url = p.slug ? siteUrlFor(p.slug) : site;
        return `<tr>
          <td style="padding:8px 12px 8px 0;"><a href="${url}" style="color:#221C17;font-weight:600;text-decoration:none;">${p.name}</a></td>
          <td style="padding:8px 12px;text-align:right;">${v} view${v === 1 ? "" : "s"}</td>
          <td style="padding:8px 0;text-align:right;">${r} response${r === 1 ? "" : "s"}</td>
        </tr>`;
      })
      .join("");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Lypo <notifications@resend.dev>",
        to: email,
        subject: `your week: ${totalViews} views, ${totalSubs} responses`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#221C17;">
  <p style="font-size:18px;font-weight:600;">your week on lypo<span style="color:#E8542F;">.</span></p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
  <p style="margin-top:24px;"><a href="${site}/dashboard" style="color:#E8542F;font-weight:600;">open your dashboard</a></p>
  <p style="font-size:12px;color:#6f6459;margin-top:24px;">Sent weekly while you have a published site.</p>
</div>`,
      }),
    }).catch(() => null);
    if (res?.ok) sent += 1;
  }

  return NextResponse.json({ sent, owners: Object.keys(byOwner).length });
}
