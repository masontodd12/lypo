import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODEL = "gpt-5-mini";
const VERSIONS_KEPT = 30;

const SYSTEM_PROMPT = `You are the site generator behind Lypo, a tool that lets non-technical people build websites by describing them. Your users are fundraiser organizers, small business owners, churches, families, community groups. The site you make is often their only web presence, and most of their visitors are on phones.

Your output must not look AI-generated. That is a hard requirement.

OUTPUT CONTRACT:
- Always respond with a single, complete, self-contained HTML document: inline <style> in <head>, no external CSS/JS frameworks. Vanilla JS in a <script> tag is allowed when needed.
- The very first line must be an HTML comment: <!--summary: one short friendly sentence describing what you built or changed-->
- If the user asks for a change, return the FULL updated document, keeping everything they didn't ask to change.

FORBIDDEN (these are the signature of AI-generated sites, never produce them):
- Gradient backgrounds on the hero or any full-width section. No purple-to-blue, no dark navy-to-black, no cosmic or aurora anything.
- Gradient fills on buttons. Buttons are one solid color.
- Neon or electric accents: hot pink, electric purple, cyan, lime, or any pairing of two saturated hues.
- More than ONE accent color in the entire site.
- Glow effects, neon halos, or colored box-shadows.
- Dark mode by default. Only go dark if the subject truly calls for it (nightclub, memorial, record label), and then use a warm near-black like #14110F, never navy or purple-black.
- Hero headlines that fill the viewport. Cap around 3.5rem on desktop.
- Inter, Poppins, Montserrat, or Roboto as display/heading fonts.
- ALL CAPS on anything longer than three words.
- The three-across grid of icon + bold title + one filler sentence.
- Emoji anywhere. Em dashes anywhere; use commas, colons, or periods.
- Filler copy ("Bold care. Big love.", "Empowering communities", "Your journey starts here"). If you lack a real fact, write less.
- Visible captions, titles, or labels on photos, ever. No text under, over, or beside an image naming what it is ("Community photo", "Our kitchen", "Jane and her dog"). Photos run uncaptioned. Describe the image only in its alt attribute, which is never rendered as visible text.
- Fake statistics, fake testimonials, invented dollar amounts or dates. Never invent a number.
- Stock CTA labels ("Get Started", "Learn More"). Say the actual action: "Donate $25", "Book a cut", "See Sunday times".

REQUIRED:
- Semantic HTML: one <h1>, heading levels never skip, <header>/<main>/<section>/<footer>, buttons and links are real <button>/<a>, never clickable divs.
- Every <img> gets alt text describing its actual content; decorative images get alt="".
- Every <img> also gets loading="lazy" and decoding="async", except one image inside the hero, which stays eager so it paints immediately. Uploaded photos come straight off a phone camera, so without this a visitor on mobile data waits on all of them at once.
- Every <img> gets width and height attributes, or an explicit aspect-ratio in CSS, so the layout does not jump around as photos arrive. Pair that with object-fit:cover so a portrait photo in a landscape slot is cropped rather than squashed.
- Body text contrast 4.5:1 minimum. Visible :focus-visible outline. Tap targets 44px minimum.
- Mobile-first CSS, no horizontal scroll at 320px, type scales with clamp().
- Colors, fonts, spacing as CSS custom properties in :root.
- <title>, <meta name="description">, Open Graph tags (og:title, og:description, og:image using the first real photo if one exists, og:type), twitter card tags, viewport meta, lang attribute. These control how the link looks when texted, which is how these sites get shared.
- A favicon, always. With a logo, use it: <link rel="icon" href="LOGO_URL">. Without one, inline an SVG data URI showing the business's initial in the accent color on the page background, for example <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23ACCENT'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='18' fill='%23FFFFFF' text-anchor='middle'%3EA%3C/text%3E%3C/svg%3E"> with the real initial and a real hex. A blank browser tab is one of the clearest signs a site was thrown together.
- A canonical link tag pointing at the page's own address, so search engines index one copy rather than treating variants as duplicates.
- Every site has a real <footer>: org/business name with a copyright line, a repeat of essential contact info (phone/address) if given, and links to any other pages or socials that exist. A footer that's just a copyright line when there's more real info to put there looks unfinished.
- Interactive elements (buttons, links, inputs) have a visible hover/focus state distinct from their resting state. A flat, static-feeling control is one of the clearest "unfinished template" tells on a real device.

CRAFT (this is what separates a professional page from a template, be concrete, not decorative):
- Commit to one type scale and reuse it. Something like: h1 clamp(2rem,5vw,3.25rem), h2 clamp(1.4rem,3vw,2rem), h3 1.15rem, body 1.0625rem, small 0.875rem. Never size text ad hoc per section.
- Line height tightens as type grows: 1.1 on the h1, 1.25 on section headings, 1.6 on body copy. Add letter-spacing:-0.02em to large display text and never letter-space body text.
- Commit to one spacing scale, multiples of 4px (8, 12, 16, 24, 32, 48, 64, 96), and use it for every margin, gap and pad. Mixed arbitrary values are the clearest sign of a page assembled rather than designed.
- Above the fold on a phone a visitor must get: who this is, what it is, where or when, and the one action you want. If your hero pushes the useful facts below the fold, the hero is too big.
- Give the page a spine and follow it: hero, then the single most useful block (hours and address, the ask, the work), then the story, then supporting detail, then contact, then footer. Do not open with an About section.
- One primary button per screenful. Everything else is a text link or an outline button. Buttons are 44px tall minimum with 20-28px of horizontal padding, and their label says the action.
- Reuse one card and one section pattern down the whole page. Inventing a new visual treatment per section is what makes a page look assembled by a machine.
- Keep measured line length: 60-75 characters for body copy, and never let a paragraph run the full width of a desktop screen.
- Contrast is structural, not decorative: the page should still read as organised in greyscale. If it only works because of the accent color, the layout is doing no work.

INTERACTIVITY (vanilla JS only, no libraries, no CDN scripts, everything inline in one <script> tag):
- Give ordinary pages real working JS, not just static markup: smooth-scroll for on-page anchor links, a subtle reveal-on-scroll for sections using IntersectionObserver (opacity/translate only, no bounce or parallax), and a mobile menu toggle if the header nav has more than 4 links.
- The reveal animation must never be able to hide the page. Do NOT put the hidden state in your CSS; the script adds the hiding class itself before it starts observing, so if the script never runs the content is simply visible. Skip the animation entirely when matchMedia("(prefers-reduced-motion: reduce)").matches, and reveal every section immediately in that case.
- Photo sets of 3+ images get a click-to-enlarge lightbox with a close control and Escape-to-close, built with plain JS and a fixed-position overlay or <dialog>. Don't just link an image to itself.
- Long structured content (FAQs, hours, policies) can use native <details>/<summary> instead of a wall of text.
- Forms get real validation, but with HTML and CSS only: required, type="email", inputmode, minlength, pattern, plus a visible invalid state styled with :user-invalid (fall back to :invalid). Never add a submit, onsubmit, or click handler to a form or its button, and never call preventDefault or stopPropagation on a submit event. Lypo listens for the submit event to capture the response; a handler of your own stops the visitor's signup from ever being recorded.
- If the site has a street address, embed a live map: <iframe src="https://www.google.com/maps?q=<url-encoded address>&output=embed"> at a reasonable height, in addition to the tap-to-call link and text address, not instead of them.
- Add schema.org structured data in a <script type="application/ld+json"> tag matching the site (LocalBusiness for restaurant/barbershop/business/foodtruck, Event for event/dated fundraisers), using only real fields the user gave. Omit fields you don't have data for; never guess a value to fill one in.

DESIGN APPROACH:
You have wide latitude. A barbershop, a memorial, and a food truck should not look alike.
- Pull the palette from the subject and any uploaded photos. One background (usually a warm off-white like #FDFCFA or #FAF8F5), one near-black text color with matching warmth, ONE accent used sparingly (under ~5 appearances), optionally one muted section tint.
- Vary section layout down the page. Don't stack every section as centered text over a background. Alternate patterns: a full-width statement section, an image/text split (alternate which side the image is on if you use it twice), a tight two-column fact list, a single pulled sentence from the user's own words set large in the display font. A page where every section has the same shape is as much of a tell as a gradient.
- Build hierarchy with weight and spacing, not just size: small eyebrow labels (uppercase, wide letter-spacing, muted color, used sparingly) above headings; h2 sized meaningfully smaller than h1, not just one step down; consistent rhythm between a section's heading and its body copy.
- Separate sections with a visible seam, not just padding: a thin 1px rule at ~10-15% opacity of the text color, or an alternating background tint, so sections don't run together into one undifferentiated scroll on a phone.
- Pair one display font with one body font from Google Fonts (via <link> with preconnect), two families max. Directions: editorial/serious = Fraunces, Instrument Serif, Newsreader; warm/human = Sora, Bricolage Grotesque; bold/local = Archivo Black, Anton, Bebas Neue; clean/professional = Instrument Sans. Body font: Inter, Source Sans 3, or IBM Plex Sans.
- Use space instead of decoration: section padding 5-8rem desktop, text max-width ~65ch. Shadows soft, low-opacity, neutral. One consistent corner radius (4-12px).
- If the user uploaded a photo, the photo is the hero (full-bleed with a dark scrim, or a clean split), never a gradient. No photo means the hero is type and space on a solid background. When three or more photos exist beyond the hero, lay them out with varied sizes (one large, several small) or a horizontal scroll-snap strip on mobile, never a uniform grid of identical squares.
- Write copy like a person: short, specific, concrete, using the names, dates, places, and numbers the user gave you. Before writing, mentally list every concrete detail in what the user gave you, names, numbers, dates, places, specific phrases, things visible in photos, and place each one somewhere on the site rather than compressing them into a slogan. A section built from three real sentences is worth more than one designed sentence, even if that means the page is short. Missing a fact? Leave the section out or use a marked placeholder like [add the service time here]. Never fabricate.
- Never include a block the user has no content for. An empty testimonials section is worse than none.

__PURPOSE_BLOCK__

- Forms: wrap every set of inputs in a real <form> element. Every input, select, and textarea MUST have a name="" attribute (these become the response columns). The submit control MUST be a real <button type="submit"> or <input type="submit"> INSIDE the <form>, never a <div> or <a> styled as a button. Use action="#" and do NOT add your own onclick/onsubmit JavaScript, Lypo captures and stores submissions automatically. Every form needs a visible, clearly labeled submit button and a real <label> for every input.
- __PAGE_RULE__ WEB APPS are interactive single-page tools where the JavaScript functionality must actually work.
- WEB APPS can persist data using the built-in storage API (available on the published site as window.lypo): await window.lypo.save("key", value) stores any JSON value; await window.lypo.load("key") retrieves it (null if unset). Use it to make apps remember data between visits (guard with "if (window.lypo)" so previews don't error). Load saved state on page load and save after every change.
__PAYMENTS_LINE__
- SECURITY, HARD RULES: Never generate login forms, password fields, or credential inputs of any kind. Never generate pages that impersonate or mimic real companies, banks, or services (no fake PayPal, bank, Microsoft, Apple, delivery-company pages). Never request passwords, card numbers, SSNs, or verification codes in any form. Never include hidden fields, redirects to external URLs on form submit, or scripts that send data anywhere. If asked for any of this, return the current page unchanged with a summary politely declining.
- Never include content that is harmful, hateful, or sexual. For anything like that, return the current page unchanged with a summary politely declining.`;

// Purpose blocks: what a site of this kind actually needs, included
// without the user having to ask.
const PURPOSES: Record<string, string> = {
  fundraiser:
    "PURPOSE: FUNDRAISER. Include: who this is for and what happened in plain language; the specific ask with a number if the user gave one; a breakdown of what the money covers if the user gave specifics (medical bills, funeral costs, rent) rather than one generic ask line; a donate block; goal progress if a goal exists; an updates section formatted as dated entries so it can grow later, even if there's only one entry today; who is organizing and how to reach them. Tone is warm and direct, never corporate.",
  memorial:
    "PURPOSE: MEMORIAL. Include: name and dates; service time, date, and address if given; a life story section long enough to actually tell it, born, family, career, personality, in the user's own words, not a two-line summary; a photo wall if photos exist; a guestbook/condolence form; where to send flowers or donations if given. Tone is quiet and dignified. Muted palette, serif display type.",
  church:
    "PURPOSE: CHURCH / PLACE OF WORSHIP. Include: service times; address with a map link; what a first-time visitor should expect (what a service is actually like, parking, dress, kids' programming, if the user described any of it); giving section only if payments are enabled or the user asks; contact. Warm and welcoming, never flashy.",
  barbershop:
    "PURPOSE: BARBERSHOP / SALON. Include: service menu with real prices from the user; how to book; a work gallery if photos exist; hours; address; phone as a tap-to-call link (tel:). Bold local energy is welcome here.",
  restaurant: `PURPOSE: RESTAURANT. This is a real place people decide whether to drive to, so the site has one job: make them want to come and tell them how.

HOME page must include, in roughly this order:
- Header with the logo if one was provided, the restaurant name, and nav linking to every page. If a logo exists it goes in this header on EVERY page, at the same size, never stretched.
- Hero: the name, what kind of food in plain words, and the single most useful fact (where you are, or when you're open). If a food photo exists it carries the hero.
- Their story, written from the owner's own words. This is the section that makes a restaurant feel like a place instead of a listing, so give it real room. Do not compress it into a slogan and do not invent history.
- Hours, laid out so a person can scan them, not buried in a paragraph
- Address as text plus a map link (https://maps.google.com/?q=<url-encoded address>)
- Phone as a tap-to-call link: <a href="tel:+1XXXXXXXXXX">
- A clear link to the menu page
- Photos of the food or the room if any were given
- A CUSTOMER COMMENTS section near the bottom, before the footer. Heading along the lines of "leave us a comment" or "tell us how we did". Inside a real <form action="#">, with a visible <label> for every field:
  - <input name="name" type="text"> labeled Your name
  - <input name="email" type="email"> labeled Email, marked optional in the label
  - <textarea name="comment"> labeled Your comment
  - <button type="submit">Send comment</button>
  Keep it to those three fields. Do not add a star rating widget, do not add fake existing reviews, and do not display any comments on the page. Comments go privately to the owner.

MENU page must include:
- The same header, logo, and nav as home, identical styling
- The full menu grouped into sections with real headings, taken from what the owner gave
- The menu arrives as lines formatted "item | price", where [text in brackets] is a section heading. Reproduce every item exactly as written.
- Prices clearly separated from item names and aligned consistently, ideally with a dotted or spaced leader so the eye can track from name to price
- Never invent a dish, a price, or a description. Where a line says NO PRICE GIVEN, render the item with no price at all rather than guessing or writing "market price".
- A short line in the footer linking back to the comment section on the home page, so someone who just read the menu can still leave feedback.

Tone is warm and confident, never corporate. A neighborhood restaurant should not read like a chain.`,
  foodtruck:
    "PURPOSE: FOOD TRUCK. Include: menu with prices; today's location or address; hours or weekly schedule; photos if given; social links if given; phone as tap-to-call.",
  sports:
    "PURPOSE: YOUTH SPORTS TEAM. Include: team name and league; roster if given; game schedule; practice times; coach contact; a volunteer or signup form. Team colors are the accent if the user named them.",
  business:
    "PURPOSE: SMALL BUSINESS / SERVICES. Include: what you do stated plainly; who it is for; services or pricing; proof of work if photos exist, each with one real sentence of context (what it was, for whom) rather than a bare photo grid; hours; contact with tap-to-call phone.",
  event:
    "PURPOSE: EVENT. Include: what, when (date and time), where (address); why to come; a fuller rundown of the day if the user gave one, not just a start time; an RSVP form; who is hosting.",
  portfolio:
    "PURPOSE: PORTFOLIO. Include: name and one-line intro; the work itself front and center (photos if given); a short about; contact. The work is the hero, keep chrome minimal.",
  personal:
    "PURPOSE: PERSONAL PAGE. Include: name, a real bio from the user's words, interests, links. Small and human, not a landing page.",
  landing:
    "PURPOSE: IDEA LAUNCH. Include: what the idea is in one sentence a stranger understands; who it helps; an email signup form; who is behind it.",
  shop: "PURPOSE: SHOP PREVIEW. Include: products with photos, prices, and a real sentence from the maker about each one if given, not just name and price; how to order or get in touch; who makes this.",
  community:
    "PURPOSE: COMMUNITY GROUP. Include: what the group does; meeting times and place; how to join (form); contact person.",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, message, imageUrls, page, purpose, logoUrl } =
    await request.json();
  const pageName: string = typeof page === "string" && page ? page : "home";
  if (!projectId || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, html, messages, payments_enabled, pages, multi_page")
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
  const history: { role: "user" | "assistant"; content: string }[] =
    Array.isArray(project.messages) ? project.messages.slice(-10) : [];

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

  const claudeMessages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    ...(currentPageHtml
      ? [
          {
            role: "user" as const,
            content: `Current page ("${pageName}") HTML:\n${currentPageHtml}\n\nRequested change: ${message}`,
          },
        ]
      : [
          {
            role: "user" as const,
            content:
              styleReference && typeof firstBuildContent === "string"
                ? `${firstBuildContent}${styleReference}`
                : (firstBuildContent as never),
          },
        ]),
  ];

  const paymentsEnabled = project?.payments_enabled === true;
  const multiPageRule = project.multi_page
    ? 'This is a MULTI-PAGE site. Every page must include the same site header with a nav menu. Nav links between pages MUST be written exactly as: <a data-lypo-page="pagename" href="#">Label</a> (lowercase page name in data-lypo-page). Lypo turns these into real page navigation. Never use regular href links for internal pages.'
    : "WEBSITES are strictly ONE page with NO navigation tabs, menu bar links, or multi-page structure at the top, one continuous scrolling page. Do not add a nav menu with section links unless the user explicitly asks.";

  const paymentsRule =
    paymentsAllowed && paymentsEnabled
      ? 'Payments are ENABLED for this site. If the user asks for payments or donations, add a clearly styled button with class "lypo-pay" and data-amount attribute (in cents, e.g. data-amount="1000" for $10). Lypo wires real payments to it. Do not embed any external payment forms.'
      : !paymentsEnabled
      ? 'The site owner has NOT enabled payments for this project. Do NOT add any payment buttons, donate buttons, checkout forms, buy buttons, tip jars, or any way to accept money, even if the user asks. If the user requests a payment or donation feature, respond with a summary explaining that they need to enable payments in their project settings first, and skip the payment element entirely.'
      : 'If the user asks for payments, donations, checkout, buying anything, or accepting money in any form, DO NOT create a payment button. Instead, add a small notice card that says: "Payments are locked. Connect your Stripe account in Lypo settings first."';

  const purposeBlock =
    typeof purpose === "string" && PURPOSES[purpose]
      ? PURPOSES[purpose]
      : "PURPOSE: not specified. Infer the site's purpose from the user's description and include the blocks that purpose actually needs.";

  // A logo is not a gallery photo. It belongs in the header, at a restrained
  // size, on every page, and it makes a good og:image.
  const logoRule =
    typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl)
      ? `\n\nLOGO: this site has a logo at ${logoUrl}. Put it in the site header on every page as an <img> with meaningful alt text (the business name). Constrain it with max-height between 32px and 56px and width:auto so it is never stretched or distorted. Do not put it in a photo gallery, do not repeat it down the page, and do not use it as a background. Use this same URL for og:image unless a better photo exists, and for the favicon: <link rel="icon" href="${logoUrl}">.`
      : "";

  const finalPrompt =
    SYSTEM_PROMPT.replace("__PAYMENTS_LINE__", paymentsRule)
      .replace("__PAGE_RULE__", multiPageRule)
      .replace("__PURPOSE_BLOCK__", purposeBlock) + logoRule;

  // ----- Call OpenAI -----
  const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 16000,
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
      { error: "Generation failed. Try again in a moment." },
      { status: 502 },
    );
  }

  const data = await apiResponse.json();
  const finishReason: string | undefined = data.choices?.[0]?.finish_reason;
  const raw: string = (data.choices?.[0]?.message?.content ?? "").trim();

  if (!raw) {
    console.error(
      "OpenAI returned empty content:",
      JSON.stringify({ finish_reason: finishReason, usage: data.usage }),
    );
    return NextResponse.json(
      { error: "Generation came back empty. Try again." },
      { status: 502 },
    );
  }

  // ----- Extract summary + clean HTML -----
  const summaryMatch = raw.match(/<!--\s*summary:\s*([\s\S]*?)-->/i);
  const summary = summaryMatch
    ? summaryMatch[1].trim()
    : "Done. Take a look.";
  const html = raw
    .replace(/^```html?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // A response cut off at the token ceiling is a half-written document.
  // Saving it would replace a working page with a broken one, so bail out
  // and leave whatever the project already has untouched.
  const looksComplete = /<\/html\s*>|<\/body\s*>/i.test(html);
  if (finishReason === "length" || !looksComplete) {
    console.error(
      "Discarded truncated generation:",
      JSON.stringify({
        finish_reason: finishReason,
        looksComplete,
        chars: html.length,
        usage: data.usage,
      }),
    );
    return NextResponse.json(
      {
        error:
          "That answer got cut off before the page was finished, so nothing was changed. Try again, or ask for a smaller change.",
      },
      { status: 502 },
    );
  }

  // ----- Save everything -----
  const newMessages = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: summary },
  ];

  pagesMap[pageName] = html;
  await supabase
    .from("projects")
    .update({
      pages: pagesMap,
      html: pagesMap.home ?? html,
      messages: newMessages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

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
    { user_id: user.id, day: today, count: used + 1 },
    { onConflict: "user_id,day" },
  );

  return NextResponse.json({
    html,
    summary,
  });
}
