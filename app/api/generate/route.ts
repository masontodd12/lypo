import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUILD_MODEL, editPage, generatePageStreamed } from "@/lib/model";
import {
  stripDangerousHrefs,
  stripPlaceholders,
  stripRootLayout,
} from "@/lib/links";
import { buildSystemPrompt, PURPOSES } from "@/lib/prompt";
import { designBrief, isDesignChoice, type DesignChoice } from "@/lib/design";

/**
 * Generating a page takes sixty to ninety seconds, and longer for a long
 * brief. Without this the platform's short default applies and the function
 * is killed mid-request, which reaches the browser as a dropped connection
 * and reads to the user as "couldn't reach the server".
 *
 * 300 is the ceiling for Node functions on Vercel. Time is only spent when a
 * generation actually runs, so a high limit costs nothing on fast requests.
 */
export const maxDuration = 300;

const VERSIONS_KEPT = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, message, imageUrls, page, purpose, logoUrl, design } =
    await request.json();
  const pageName: string = typeof page === "string" && page ? page : "home";
  if (!projectId || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Roughly 18,000 words. Generous: a full interview with a long story and a
  // pasted menu lands nowhere near it. Past this the model spends the whole
  // budget reading rather than writing, and the request runs long enough to
  // be killed, which reaches the browser as a dropped connection.
  const MAX_MESSAGE_CHARS = 100_000;
  if (typeof message !== "string" || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      {
        error:
          "That is more than we can read in one go. Trim it down, or build the page first and add the rest as follow-up changes.",
      },
      { status: 413 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, html, messages, pages, multi_page")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ----- The design choice: template plus color -----
  // Onboarding sends it on the first build. Every later edit has to reach
  // the same brief, or a page drifts to a different palette the first time
  // someone asks to change a phone number, so it is stored on the project
  // and read back when the client does not send one.
  //
  // Read separately and defensively: this column arrives with a migration,
  // and a project created before it ran must still be editable.
  let storedDesign: DesignChoice | null = null;
  try {
    const { data } = await supabase
      .from("projects")
      .select("design")
      .eq("id", projectId)
      .maybeSingle();
    if (isDesignChoice(data?.design)) storedDesign = data.design;
  } catch {
    // Column not there yet. Falls through to the default brief.
  }

  const chosenDesign: DesignChoice = isDesignChoice(design)
    ? design
    : (storedDesign ?? { template: "editorial", accent: "#2C5545" });

  // Persist a newly chosen design so later edits inherit it. Best-effort:
  // a site that cannot record its design still builds with it today.
  if (isDesignChoice(design) && design !== storedDesign) {
    try {
      await supabase
        .from("projects")
        .update({ design })
        .eq("id", projectId);
    } catch {
      // Same as above.
    }
  }

  // Editing is not capped. The ceiling is on starting new sites (see
  // lib/limits.ts), so someone can keep working on their site until it is
  // right rather than running out of edits partway through.
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from("usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();
  const used = usage?.count ?? 0;

  // ----- Build the conversation -----
  // Every turn is kept, tagged with the page it belongs to. Slicing here as
  // well as when writing back used to delete anything older than the last
  // dozen turns permanently, not merely hide it from the model.
  type Turn = {
    role: "user" | "assistant";
    content: string;
    page?: string;
  };
  const allTurns: Turn[] = Array.isArray(project.messages)
    ? (project.messages as Turn[])
    : [];

  // Each page is its own conversation. Editing the menu should not hand the
  // model ten turns about the home page, which is both confusing context and
  // a good way to have it change the wrong thing.
  const history = allTurns
    .filter((m) => (m.page ?? "home") === pageName)
    .slice(-10);

  const pagesMap: Record<string, string> =
    project.pages && typeof project.pages === "object"
      ? { ...(project.pages as Record<string, string>) }
      : project.html
      ? { home: project.html }
      : {};
  const currentPageHtml = pagesMap[pageName] ?? (pageName === "home" ? project.html : null);

  const images: string[] = Array.isArray(imageUrls) ? imageUrls.slice(0, 4) : [];
  const firstBuildContent =
    images.length > 0
      ? [
          {
            type: "text",
            text: `Build this: ${message}\n\nPhotos are attached. READ them carefully: extract any business name, menu items, prices, hours, phone numbers, colors, and branding you can see, and use all of it in the site. Also embed the photos themselves where they fit, and pull the site's palette from them.`,
          },
          ...images.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ]
      : `Build this: ${message}`;

  const styleReference =
    !currentPageHtml && pageName !== "home" && pagesMap.home
      ? `\n\nThis is a NEW page called "${pageName}" for an existing multi-page site. Match the exact style, fonts, colors, header, and nav of the home page below. The nav must include a link to every page: ${Object.keys(pagesMap).concat(pageName).join(", ")}.\n\nHome page for style reference:\n${pagesMap.home}`
      : "";

  const priorTurns = history.map((m) => ({
    role: m.role,
    content: m.content as unknown,
  }));

  // A first build writes the whole document; an edit patches the one that
  // already exists. editPage owns building its own messages.
  const firstBuildMessages = [
    ...priorTurns,
    {
      role: "user" as const,
      content:
        styleReference && typeof firstBuildContent === "string"
          ? `${firstBuildContent}${styleReference}`
          : (firstBuildContent as never),
    },
  ];

  const multiPageRule = project.multi_page
    ? 'This is a MULTI-PAGE site. Every page must include the same site header with a nav menu. Nav links between pages MUST be written exactly as: <a data-lypo-page="pagename" href="#">Label</a> (lowercase page name in data-lypo-page). Lypo turns these into real page navigation. Never use regular href links for internal pages.'
    : "WEBSITES are strictly ONE page with NO navigation tabs, menu bar links, or multi-page structure at the top, one continuous scrolling page. Do not add a nav menu with section links unless the user explicitly asks.";

  // Lypo does not process payments, and there is no setting anywhere that
  // changes that. Stated as a fact about the site rather than as something
  // to go and switch on, because there is nothing to find.
  const paymentsRule =
    'This site CANNOT take money, and never will be able to. Do NOT add payment buttons, donate buttons, checkout forms, buy buttons, tip jars, price-and-pay widgets, shopping carts, or links out to an external payment page (Stripe, PayPal, Venmo, Cash App, GoFundMe or any other), even if the user asks directly. Prices may be SHOWN as plain text; there is simply no way to pay them here. If the user asks for payments, say in the summary that Lypo does not handle payments, and build the rest of what they asked for. Where money would have been the action, use the phone number or the contact form instead.';

  const purposeBlock =
    typeof purpose === "string" && PURPOSES[purpose]
      ? PURPOSES[purpose]
      : "PURPOSE: not specified. Infer the site's purpose from the user's description and include the blocks that purpose actually needs.";

  // A logo is not a gallery photo. It belongs in the header, at a restrained
  // size, on every page, and it makes a good og:image.
  const logoRule =
    typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl)
      ? `LOGO: this site has a logo at ${logoUrl}. Put it in the site header on every page as an <img> with meaningful alt text (the business name). Constrain it with max-height between 32px and 56px and width:auto so it is never stretched or distorted. Do not put it in a photo gallery, do not repeat it down the page, and do not use it as a background. Use this same URL for og:image unless a better photo exists, and for the favicon: <link rel="icon" href="${logoUrl}">.`
      : "";

  const finalPrompt = buildSystemPrompt({
    designBrief: designBrief(chosenDesign),
    purpose: purposeBlock,
    pageRule: multiPageRule,
    paymentsRule,
    logoRule,
  });

  // Captured because the earlier null check does not narrow inside a
  // closure, which TypeScript is right to insist on.
  const userId = user.id;

  // Persisted only once a complete document is in hand, so a failed or
  // half-written generation never touches the project.
  async function persist(rawHtml: string, summary: string): Promise<string> {
    // A generated page is arbitrary HTML from a model, and it is served on
    // the owner's own domain. The prompt forbids invented links, but a rule
    // in a prompt is not a guarantee, and a javascript: href would run with
    // that site's origin. Cheap to enforce for real, so enforce it.
    const safe = stripDangerousHrefs(rawHtml);
    if (safe.removed > 0) {
      console.warn(
        `stripped ${safe.removed} unsafe link${safe.removed === 1 ? "" : "s"} from ${pageName}`,
      );
    }
    // A width on :root clamps the whole document and pins it to the left of
    // the screen, which is a whole-page defect from one missing pair of
    // dashes, so it is worth catching rather than only asking nicely.
    const laidOut = stripRootLayout(safe.html);
    if (laidOut.removed > 0) {
      console.warn(`removed a page-clamping width from :root on ${pageName}`);
    }
    // "[add price]" reaching a real customer reads as an abandoned site.
    const filled = stripPlaceholders(laidOut.html);
    if (filled.removed.length > 0) {
      console.warn(
        `removed placeholder text from ${pageName}: ${filled.removed.join(", ")}`,
      );
    }
    const html = filled.html;

  const turns = [
    { role: "user", content: message, page: pageName },
    { role: "assistant", content: summary, page: pageName },
  ];

  // Merges this one page under a row lock. Extra pages are generated
  // concurrently, and writing the whole pages object back would mean the
  // last request to finish silently erased the others.
  const { error: mergeError } = await supabase.rpc("save_project_page", {
    pid: projectId,
    page_name: pageName,
    page_html: html,
    new_turns: turns,
  });

  if (mergeError) {
    // The function is missing until the migration runs. Re-reading right
    // before writing does not make this safe, but it shrinks the window
    // from the length of a generation to a few milliseconds.
    console.error("save_project_page unavailable, falling back:", mergeError.message);
    const { data: fresh } = await supabase
      .from("projects")
      .select("pages, messages, html")
      .eq("id", projectId)
      .single();

    const freshPages: Record<string, string> = {
      ...(pagesMap as Record<string, string>),
      ...((fresh?.pages as Record<string, string>) ?? {}),
      [pageName]: html,
    };
    const freshTurns = [
      ...(Array.isArray(fresh?.messages) ? fresh.messages : allTurns),
      ...turns,
    ].slice(-400);

    await supabase
      .from("projects")
      .update({
        pages: freshPages,
        html: pageName === "home" ? html : (fresh?.html ?? freshPages.home ?? html),
        messages: freshTurns,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
  }

  // ----- Version snapshot (best-effort, never blocks the response) -----
  try {
    await supabase.from("project_versions").insert({
      project_id: projectId,
      page: pageName,
      html,
      summary,
    });
    // Prune: keep only the newest VERSIONS_KEPT per page
    const { data: old } = await supabase
      .from("project_versions")
      .select("id")
      .eq("project_id", projectId)
      .eq("page", pageName)
      .order("created_at", { ascending: false })
      .range(VERSIONS_KEPT, VERSIONS_KEPT + 50);
    if (old && old.length > 0) {
      await supabase
        .from("project_versions")
        .delete()
        .in("id", old.map((v) => v.id));
    }
  } catch {
    // table may not exist yet; generation still succeeds
  }

  await supabase.from("usage").upsert(
    { user_id: userId, day: today, count: used + 1 },
    { onConflict: "user_id,day" },
  );

    return html;
  }

  // Streamed as newline-delimited JSON so the builder can show that work is
  // happening instead of a dead minute. The page is still only revealed once
  // it is complete and saved: a half-written document must never be shown as
  // if it were a finished site.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (open) controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        const onDelta = (text: string) => send({ t: "delta", v: text });
        const result = currentPageHtml
          ? await editPage({
              // Patching an existing page stays on the cheap model; only a
              // rejected patch falls through to a full rewrite, which is a
              // build and gets the build model.
              system: finalPrompt,
              currentHtml: currentPageHtml,
              instruction: message,
              history: priorTurns,
              pageName,
              rewriteModel: BUILD_MODEL,
              onDelta,
            })
          : await generatePageStreamed({
              system: finalPrompt,
              messages: firstBuildMessages,
              model: BUILD_MODEL,
              onDelta,
            });

        if (!result.ok) {
          send({ t: "error", error: result.error });
          return;
        }

        // The stored html, not the raw model output, so what the preview
        // shows is exactly what was saved and what visitors will get.
        const savedHtml = await persist(result.html, result.summary);
        send({ t: "done", html: savedHtml, summary: result.summary });
      } catch (e) {
        console.error("generate failed:", e);
        send({
          t: "error",
          error: "Something went wrong building that. Nothing was changed.",
        });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
