import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";

// Another model call; see the generate route.
export const maxDuration = 120;

const MODEL = "gpt-5-mini";

const ROAST_PROMPT = `You are the honest friend behind Lypo's roast mode. The user is about to publish their site and wants the truth before strangers see it.

Critique the HTML page you are given, as a sharp friend would, focused on whether it will actually work for its goal (donations, bookings, signups, sales). Check:
- Is the headline specific, or vague filler? Would a stranger know what this is in 3 seconds?
- Is there one clear ask, and is it visible without scrolling on a phone?
- Do buttons say the actual action, or "Learn More"?
- Is anything missing that this kind of site needs (price, date, address, phone, donate button)?
- Trust signals: does it say who is behind this and how to reach them?
- Images: missing alt text, generic captions, or no photos where photos would sell it?
- Anything that looks AI-generated or template-y that hurts credibility?

Rules:
- Be direct and a little funny, never mean about the person or their cause. Roast the page, not the person.
- Number your points, worst problem first. 3 to 6 points, one or two sentences each.
- Each point ends with the fix, phrased so they can paste it straight into the builder chat.
- If the page is actually good, say so and only nitpick.
- Plain text only, no markdown headers, no emoji, no em dashes.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!rateLimit(`${user.id}:roast`, 10, 60 * 60 * 1000).ok) {
    return NextResponse.json(
      { error: "Easy. You can only get roasted 10 times an hour." },
      { status: 429 },
    );
  }

  const { projectId, page } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  const pageName: string = typeof page === "string" && page ? page : "home";

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, html, pages")
    .eq("id", projectId)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pagesMap = (project.pages ?? null) as Record<string, string> | null;
  const html = pagesMap?.[pageName] ?? project.html;
  if (!html) {
    return NextResponse.json(
      { error: "Build something first, then I'll roast it." },
      { status: 400 },
    );
  }

  const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: ROAST_PROMPT },
        { role: "user", content: `Roast this page:\n${html}` },
      ],
    }),
  });

  if (!apiResponse.ok) {
    return NextResponse.json(
      { error: "The roast fell flat. Try again in a moment." },
      { status: 502 },
    );
  }

  const data = await apiResponse.json();
  const roast: string = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!roast) {
    return NextResponse.json(
      { error: "The roast came back empty. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ roast });
}
