import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 30;
const MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `You are the site generator behind Lypo, a free tool that lets non-technical people build websites by describing them.

Rules:
- Always respond with a single, complete, self-contained HTML document: inline <style>, no external files, no JavaScript frameworks. Vanilla JS in a <script> tag is allowed when needed.
- The very first line must be an HTML comment: <!--summary: one short friendly sentence describing what you built or changed-->
- Design quality matters: modern, clean, responsive, real typography, generous spacing. Use Google Fonts via <link>. Never produce placeholder-looking pages.
- Write real copy based on the user's idea, not lorem ipsum.
- If the user asks for a change, return the FULL updated document, keeping everything they didn't ask to change.
- Forms: wrap every set of inputs in a real <form> element. Every input, select, and textarea MUST have a name="" attribute (these become the response columns). The submit control MUST be a real <button type="submit"> or <input type="submit"> INSIDE the <form> — never a <div> or <a> styled as a button. Use action="#" and do NOT add your own onclick/onsubmit JavaScript — Lypo captures and stores submissions automatically. Every form needs a visible, clearly labeled submit button (e.g. "Join the team", "Sign up", "Send").
- WEBSITES are strictly ONE page with NO navigation tabs, menu bar links, or multi-page structure at the top — one continuous scrolling page. Do not add a nav menu with section links unless the user explicitly asks. WEB APPS are interactive single-page tools where the JavaScript functionality must actually work.
- WEB APPS can persist data using the built-in storage API (available on the published site as window.lypo): await window.lypo.save("key", value) stores any JSON value; await window.lypo.load("key") retrieves it (null if unset). Use it to make apps remember data between visits (guard with "if (window.lypo)" so previews don't error). Load saved state on page load and save after every change.
__PAYMENTS_LINE__
- Never include content that is harmful, hateful, or sexual. For anything like that, return the current page unchanged with a summary politely declining.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, message, imageUrls } = await request.json();
  if (!projectId || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, html, messages, payments_enabled")
    .eq("id", projectId)
    .single();

  // Has this user connected Stripe? Payments are locked otherwise.
  const { data: stripeAccount } = await supabase
    .from("stripe_accounts")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const paymentsAllowed = !!stripeAccount?.account_id;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ----- Daily usage limit -----
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();

  const used = usage?.count ?? 0;
  if (used >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `You've used today's ${DAILY_LIMIT} edits — they reset tomorrow.`,
      },
      { status: 429 },
    );
  }

  // ----- Build the conversation for Claude -----
  const history: { role: "user" | "assistant"; content: string }[] =
    Array.isArray(project.messages) ? project.messages.slice(-10) : [];

  const images: string[] = Array.isArray(imageUrls) ? imageUrls.slice(0, 4) : [];
  const firstBuildContent =
    images.length > 0
      ? [
          {
            type: "text",
            text: `Build this: ${message}\n\nPhotos are attached. READ them carefully: extract any business name, menu items, prices, hours, phone numbers, colors, and branding you can see, and use all of it in the site. Also embed the photos themselves where they fit.`,
          },
          ...images.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ]
      : `Build this: ${message}`;

  const claudeMessages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    ...(project.html
      ? [
          {
            role: "user" as const,
            content: `Current page HTML:\n${project.html}\n\nRequested change: ${message}`,
          },
        ]
      : [{ role: "user" as const, content: firstBuildContent as never }]),
  ];

  const paymentsEnabled = project?.payments_enabled === true;
  const paymentsRule =
    paymentsAllowed && paymentsEnabled
      ? 'Payments are ENABLED for this site. If the user asks for payments or donations, add a clearly styled button with class "lypo-pay" and data-amount attribute (in cents, e.g. data-amount="1000" for $10). Lypo wires real payments to it. Do not embed any external payment forms.'
      : !paymentsEnabled
      ? 'The site owner has NOT enabled payments for this project. Do NOT add any payment buttons, donate buttons, checkout forms, buy buttons, tip jars, or any way to accept money — even if the user asks. If the user requests a payment or donation feature, respond with a summary explaining that they need to enable payments in their project settings first, and skip the payment element entirely.'
      : 'If the user asks for payments, donations, checkout, buying anything, or accepting money in any form, DO NOT create a payment button. Instead, add a small notice card that says: "Payments are locked — connect your Stripe account in Lypo settings first."';
  const finalPrompt = SYSTEM_PROMPT.replace("__PAYMENTS_LINE__", paymentsRule);

  // ----- Call OpenAI -----
  const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 8000,
      messages: [
        { role: "system", content: finalPrompt },
        ...claudeMessages,
      ],
    }),
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("OpenAI API error:", detail);
    return NextResponse.json(
      { error: "Generation failed — try again in a moment." },
      { status: 502 },
    );
  }

  const data = await apiResponse.json();
  const raw: string = (data.choices?.[0]?.message?.content ?? "").trim();

  if (!raw) {
    return NextResponse.json(
      { error: "Generation came back empty — try again." },
      { status: 502 },
    );
  }

  // ----- Extract summary + clean HTML -----
  const summaryMatch = raw.match(/<!--\s*summary:\s*([\s\S]*?)-->/i);
  const summary = summaryMatch
    ? summaryMatch[1].trim()
    : "Done — take a look.";
  const html = raw
    .replace(/^```html?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // ----- Save everything -----
  const newMessages = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: summary },
  ];

  await supabase
    .from("projects")
    .update({
      html,
      messages: newMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  await supabase.from("usage").upsert(
    { user_id: user.id, day: today, count: used + 1 },
    { onConflict: "user_id,day" },
  );

  return NextResponse.json({
    html,
    summary,
    remaining: DAILY_LIMIT - used - 1,
  });
}
