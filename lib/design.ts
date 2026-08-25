/**
 * The design system behind a generated site.
 *
 * Two decisions come out of onboarding: a TEMPLATE (layout and typography)
 * and a COLOR (one accent, optionally a second supporting one). Everything
 * else, the full palette included, is derived here rather than left to the
 * model.
 *
 * That split is deliberate. Asking a model for "warm and inviting" produces
 * a different page every time and a readable one only by luck. Asking it to
 * use #8A3324 on #FDFBF7, with the contrast already checked, produces the
 * same page twice and a legible one always.
 */

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

export type Rgb = [number, number, number];
export type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Accepts #abc, #aabbcc, or the same without the hash. */
export function parseHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`;
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const v = parseHex(hex) ?? "#000000";
  return [
    parseInt(v.slice(1, 3), 16),
    parseInt(v.slice(3, 5), 16),
    parseInt(v.slice(5, 7), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): Hsl {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Nudges a foreground color until it is actually readable on its background.
 *
 * The whole point of letting someone pick their own color is that they pick
 * whatever they like, including a yellow that is invisible on off-white.
 * Rather than refuse the color, keep its hue and move its lightness until
 * the pair passes. The site stays theirs and stays legible.
 */
export function ensureContrast(fg: string, bg: string, target = 4.5): string {
  if (contrast(fg, bg) >= target) return fg;
  const { h, s } = hexToHsl(fg);
  // Darken against a light background, lighten against a dark one.
  const goDarker = luminance(bg) > 0.4;
  let best = fg;
  let bestRatio = contrast(fg, bg);
  for (let step = 1; step <= 100; step++) {
    const l = goDarker ? hexToHsl(fg).l - step : hexToHsl(fg).l + step;
    if (l < 0 || l > 100) break;
    const candidate = hslToHex({ h, s, l });
    const ratio = contrast(candidate, bg);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= target) return candidate;
  }
  return best;
}

/**
 * Fits a solid fill and the text that sits on it.
 *
 * Picking whichever of near-white and near-black reads better is not enough
 * on its own: a mid-toned accent like amber leaves white at about 4.4, under
 * the bar, and a bright yellow leaves both candidates hopeless. When neither
 * label works, the fill itself moves instead. A button a few percent darker
 * than the color someone picked is invisible to them; unreadable text on it
 * is the first thing everyone sees.
 */
function fitFill(
  fill: string,
  nearWhite: string,
  nearBlack: string,
): { fill: string; ink: string } {
  const ink =
    contrast(nearWhite, fill) >= contrast(nearBlack, fill) ? nearWhite : nearBlack;
  if (contrast(ink, fill) >= 4.5) return { fill, ink };
  return { fill: ensureContrast(fill, ink, 4.5), ink };
}

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  line: string;
  /** The chosen color at full strength: buttons, solid blocks. */
  accent: string;
  /** Text drawn on top of a solid accent fill. */
  accentInk: string;
  /** The accent adjusted so it is readable as text or a link on bg. */
  accentText: string;
  /** Optional second color, section backgrounds only. */
  tint: string | null;
  tintInk: string | null;
  dark: boolean;
};

/**
 * Builds a whole palette from one or two chosen colors.
 *
 * Neutrals carry a trace of the accent's hue. A truly neutral grey next to a
 * warm red is the flat, unconsidered look that reads as a template; the
 * shared hue is most of what makes a palette feel chosen rather than
 * assembled.
 */
export function derivePalette(
  accentInput: string,
  secondInput?: string | null,
  dark = false,
): Palette {
  const chosen = parseHex(accentInput) ?? "#1F6F5C";
  const { h, s } = hexToHsl(chosen);
  const second = secondInput ? parseHex(secondInput) : null;

  // Candidates for text on a solid accent fill. Both are computed from the
  // accent's own hue and exist in both modes: a dark page still needs a
  // genuinely dark option, or a yellow button gets near-white on yellow.
  const nearWhite = hslToHex({ h, s: clamp(s * 0.08, 0, 6), l: 97 });
  const nearBlack = hslToHex({ h, s: clamp(s * 0.14, 0, 12), l: 12 });
  const { fill: accent, ink: accentInk } = fitFill(chosen, nearWhite, nearBlack);

  if (dark) {
    // Warm near-black, never navy or purple-black.
    const bg = hslToHex({ h, s: clamp(s * 0.12, 0, 10), l: 8 });
    const surface = hslToHex({ h, s: clamp(s * 0.14, 0, 12), l: 13 });
    const ink = hslToHex({ h, s: clamp(s * 0.08, 0, 8), l: 95 });
    const tint = second
      ? hslToHex({ h: hexToHsl(second).h, s: clamp(hexToHsl(second).s * 0.3, 0, 24), l: 15 })
      : null;
    return {
      bg,
      surface,
      ink,
      inkSoft: ensureContrast(hslToHex({ h, s: clamp(s * 0.1, 0, 8), l: 66 }), bg, 4.5),
      line: hslToHex({ h, s: clamp(s * 0.14, 0, 12), l: 22 }),
      accent,
      accentInk,
      accentText: ensureContrast(accent, bg, 4.5),
      tint,
      tintInk: tint ? ensureContrast(ink, tint, 4.5) : null,
      dark: true,
    };
  }

  const bg = hslToHex({ h, s: clamp(s * 0.16, 0, 14), l: 97.5 });
  const surface = hslToHex({ h, s: clamp(s * 0.2, 0, 16), l: 94 });
  const ink = hslToHex({ h, s: clamp(s * 0.14, 0, 12), l: 12 });
  const tint = second
    ? hslToHex({ h: hexToHsl(second).h, s: clamp(hexToHsl(second).s * 0.32, 0, 26), l: 93 })
    : null;
  return {
    bg,
    surface,
    ink,
    inkSoft: ensureContrast(hslToHex({ h, s: clamp(s * 0.1, 0, 9), l: 40 }), bg, 4.5),
    line: hslToHex({ h, s: clamp(s * 0.16, 0, 14), l: 87 }),
    accent,
    accentInk,
    accentText: ensureContrast(accent, bg, 4.5),
    tint,
    tintInk: tint ? ensureContrast(ink, tint, 4.5) : null,
    dark: false,
  };
}

/**
 * The swatches offered in onboarding.
 *
 * Chosen so that every one of them derives into a palette that looks
 * deliberate. Someone who wants a color that is not here can still type a
 * hex; these exist so that the fast path is also the good path.
 */
export const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: "clay", label: "clay", hex: "#B4552D" },
  { id: "brick", label: "brick", hex: "#9C3B2E" },
  { id: "rust", label: "rust", hex: "#8A3324" },
  { id: "amber", label: "amber", hex: "#B07A16" },
  { id: "olive", label: "olive", hex: "#5F6B3A" },
  { id: "forest", label: "forest", hex: "#2C5545" },
  { id: "teal", label: "teal", hex: "#1F6F6B" },
  { id: "slate", label: "slate", hex: "#3C5468" },
  { id: "navy", label: "navy", hex: "#26375E" },
  { id: "plum", label: "plum", hex: "#5E3350" },
  { id: "wine", label: "wine", hex: "#6E2639" },
  { id: "ink", label: "ink", hex: "#22201C" },
];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type Template = {
  id: string;
  label: string;
  /** One line, shown under the name in the picker. */
  blurb: string;
  /** Site types this suits, used to order the gallery. Empty means any. */
  suits: string[];
  fonts: { display: string; body: string; weights: string };
  /** The accent the gallery card previews in, before the owner picks one. */
  defaultAccent: string;
  /** Preview hints for the gallery card, not sent to the model. */
  preview: {
    heroAlign: "left" | "center";
    displayFamily: string;
    /** Rough weight of the mock headline in the card. */
    displayWeight: number;
    caps: boolean;
    radius: number;
  };
  /** The exact instructions the model receives. Concrete, never adjectival. */
  spec: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "editorial",
    label: "editorial",
    defaultAccent: "#9C3B2E",
    blurb: "magazine layout, big serif headlines, hairline rules",
    suits: ["restaurant", "portfolio", "personal", "business", "event"],
    fonts: { display: "Fraunces", body: "Source Sans 3", weights: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600" },
    preview: { heroAlign: "left", displayFamily: "Georgia, serif", displayWeight: 700, caps: false, radius: 2 },
    spec: `TEMPLATE: EDITORIAL. A printed magazine feature, translated to the web.
- Display face Fraunces, body Source Sans 3. Headings 600-700 weight, letter-spacing -0.02em.
- Hero: left-aligned. A small letter-spaced uppercase eyebrow, then an h1 at clamp(2.5rem,6vw,4rem) with line-height 1.05, then one sentence of standfirst copy at 1.25rem in the muted ink color, held to 45ch. If a photo exists it sits below the headline, full-bleed, 16:9 or wider.
- Sections separated by a 1px rule in the line color that spans the container, with the section eyebrow sitting directly under it.
- Body copy in a single column at max-width 68ch. Never two columns of body text on a phone.
- Corner radius 2px everywhere. No shadows at all. Borders do the work.
- Where a section leads with a number or a date, set it in the display face at 2.5rem in the muted ink color, beside its label rather than above it.
- Pull one real sentence from the owner's own words and set it as a standalone statement at clamp(1.5rem,3.5vw,2.25rem) in the display face, with a 2px accent-colored rule above it that stops at 64px rather than spanning the width.`,
  },
  {
    id: "studio",
    label: "studio",
    defaultAccent: "#22201C",
    blurb: "modern, minimal, enormous white space",
    suits: ["business", "portfolio", "landing", "personal", "shop"],
    fonts: { display: "Instrument Sans", body: "Instrument Sans", weights: "Instrument+Sans:wght@400;500;600;700" },
    preview: { heroAlign: "left", displayFamily: "Helvetica, Arial, sans-serif", displayWeight: 600, caps: false, radius: 6 },
    spec: `TEMPLATE: STUDIO. Contemporary and restrained, the way a good design studio's own site looks.
- One family throughout: Instrument Sans. Hierarchy comes from weight and size, never from a second face.
- Hero: left-aligned, headline at clamp(2.25rem,5.5vw,3.5rem) weight 600, letter-spacing -0.03em, line-height 1.08. Nothing centered anywhere on the page.
- Section padding is large: 8rem desktop, 4rem phone. When in doubt add more.
- Every section opens with a two-column head on desktop: a small uppercase eyebrow at 0.75rem letter-spacing 0.12em in the muted ink on the left, the heading and body on the right. On a phone they stack.
- Corner radius 6px. One barely-visible shadow at most, 0 1px 2px rgba(0,0,0,0.04). Borders 1px in the line color.
- Buttons are solid accent with 14px 28px padding and radius 6px. Secondary actions are plain underlined text links, never a second button style.
- Facts (hours, address, prices) are laid out as a bordered two-column list, label left in muted ink, value right in full ink, one 1px row divider between each.`,
  },
  {
    id: "stacked",
    label: "stacked",
    defaultAccent: "#B4552D",
    blurb: "poster energy, huge type, solid color blocks",
    suits: ["foodtruck", "barbershop", "event", "sports", "fundraiser", "shop"],
    fonts: { display: "Archivo Black", body: "Work Sans", weights: "Archivo+Black&family=Work+Sans:wght@400;500;600" },
    preview: { heroAlign: "left", displayFamily: "Impact, Haettenschweiler, sans-serif", displayWeight: 900, caps: true, radius: 0 },
    spec: `TEMPLATE: STACKED. A gig poster: loud, confident, built from solid slabs of color.
- Display face Archivo Black, body Work Sans. The display face is only ever used for headings, never for a paragraph.
- Hero: a full-width block filled solid with the accent color, with the name set in the display face at clamp(2.75rem,9vw,5rem), line-height 0.95, letter-spacing -0.02em, in the accent-ink color. One line of supporting copy beneath it and one button.
- Alternate full-width section backgrounds down the page: page background, then the surface tint, then page background again. Each band runs edge to edge; only the text inside is contained.
- Corner radius 0 everywhere. Hard edges are the whole idea. No shadows.
- Headings may be uppercase, but only when three words or fewer. Body copy is never uppercase.
- Buttons are solid, radius 0, with a 3px offset border-style block shadow in the ink color that disappears on hover as the button shifts 2px down and right.
- Prices, times and numbers are set large in the display face beside their labels, not buried in sentences.`,
  },
  {
    id: "classic",
    label: "classic",
    defaultAccent: "#26375E",
    blurb: "traditional, centered, warm and trustworthy",
    suits: ["church", "business", "restaurant", "community", "memorial"],
    fonts: { display: "Newsreader", body: "IBM Plex Sans", weights: "Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600" },
    preview: { heroAlign: "center", displayFamily: "Georgia, serif", displayWeight: 500, caps: false, radius: 4 },
    spec: `TEMPLATE: CLASSIC. The dependable local institution: symmetric, warm, unhurried.
- Display face Newsreader at 500-600, body IBM Plex Sans.
- Hero: centered. Name in the display face at clamp(2.25rem,5vw,3.25rem), one line beneath it in muted ink, one button. If a photo exists it is full-bleed behind the hero with a solid dark scrim at 55% opacity so the text keeps its contrast, never a gradient scrim.
- Section headings are centered with a short centered ornament rule beneath them: 48px wide, 2px tall, in the accent color. Body copy inside sections is left-aligned at max-width 65ch, centered as a block with margin-inline auto.
- Corner radius 4px. Shadows soft and rare: 0 2px 8px rgba(0,0,0,0.05) on cards only.
- Hours and service times get their own bordered panel in the surface color, centered, with each line as a label-value pair.
- Keep the page calm. No animation beyond a gentle fade-in, no bold color outside the accent.`,
  },
  {
    id: "gallery",
    label: "gallery",
    defaultAccent: "#2C2A26",
    blurb: "photos first, type stays out of the way",
    suits: ["portfolio", "restaurant", "shop", "barbershop", "personal"],
    fonts: { display: "Instrument Serif", body: "Inter", weights: "Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600" },
    preview: { heroAlign: "left", displayFamily: "Times New Roman, serif", displayWeight: 400, caps: false, radius: 0 },
    spec: `TEMPLATE: GALLERY. The work is the site. Everything else gets out of its way.
- Display face Instrument Serif at 400, body Inter. Type is deliberately quiet: the largest heading on the page is clamp(2rem,4.5vw,3rem) and there is nothing bolder than 600 anywhere.
- Hero: a single full-bleed photo at 70vh minimum with object-fit cover, and the name set beneath it rather than over it, left-aligned, small. If there is no photo the hero is the name alone in the display face on the page background with 12rem of space below it.
- Photo layout is a mosaic, never a uniform grid: one image spanning the full container width, then a row of two, then one, using CSS grid with explicit column spans. On a phone it becomes a single column, full width, no gaps at the page edge.
- Every photo set of three or more gets the click-to-enlarge lightbox.
- Corner radius 0 on images and everything else. No borders on photos, no shadows, no captions.
- Chrome is minimal: the header is text only, no background, and the footer is three lines at most.
- Sections are separated by space alone, 7rem desktop and 3.5rem phone, with no rules and no background changes.`,
  },
  {
    id: "counter",
    label: "counter",
    defaultAccent: "#8A3324",
    blurb: "menus and prices, tight and scannable",
    suits: ["restaurant", "foodtruck", "barbershop", "shop", "business"],
    fonts: { display: "Bricolage Grotesque", body: "Source Sans 3", weights: "Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Sans+3:wght@400;500;600" },
    preview: { heroAlign: "center", displayFamily: "Helvetica, Arial, sans-serif", displayWeight: 700, caps: true, radius: 4 },
    spec: `TEMPLATE: COUNTER. Built around a list of things and what they cost.
- Display face Bricolage Grotesque at 700, body Source Sans 3.
- Hero: centered, compact, no more than 55vh. Name, one line saying what the food or service is, and the single most useful fact (where, or when open) directly beneath. The order button or phone number sits in the hero, not further down.
- Menu and service lists are the centerpiece. Each group gets an uppercase letter-spaced heading at 0.8rem in the accent color, then rows of item and price. Item name left in full ink at 1.0625rem, price right in the display face, with a dotted leader between them made with a repeating linear-gradient or a border-bottom on a flex spacer. Items with no price render the name alone, with nothing where the price would be.
- A short italic description line under an item is allowed only when the owner actually wrote one.
- Corner radius 4px. Section backgrounds alternate between the page background and the surface tint so groups stay visually separate on a phone.
- Hours are a two-column list, day left, times right, with today's row marked in the accent color.
- Nothing decorative. Every element on the page is a fact someone needs before they drive over.`,
  },
  {
    id: "notice",
    label: "notice",
    defaultAccent: "#3C5468",
    blurb: "quiet and dignified, lots of air",
    suits: ["memorial", "church", "community", "personal", "event"],
    fonts: { display: "Newsreader", body: "Source Sans 3", weights: "Newsreader:opsz,wght@6..72,300;6..72,400&family=Source+Sans+3:wght@400;500" },
    preview: { heroAlign: "center", displayFamily: "Georgia, serif", displayWeight: 400, caps: false, radius: 2 },
    spec: `TEMPLATE: NOTICE. Restrained to the point of silence. Nothing on the page raises its voice.
- Display face Newsreader at 300-400, body Source Sans 3. Nothing on the page is bold. The h1 is clamp(1.875rem,4vw,2.75rem) at weight 400.
- Hero: centered, with a great deal of space above and below, 6rem minimum on a phone. A name, then dates or a single line beneath it in muted ink. If a portrait exists it sits above the name, no wider than 320px, radius 2px, and it is the only photo above the fold.
- One column the whole way down, max-width 62ch, centered. No cards, no panels, no two-column layouts anywhere.
- The accent color appears at most three times on the entire page, and never as a large fill. Use it on a short rule and on link underlines.
- Sections are separated by 6rem of space and a centered 32px hairline rule in the line color, nothing more.
- No animation beyond a plain fade. No hover transforms. No shadows.
- Body copy at 1.125rem with line-height 1.75. The extra line-height is doing real work here; keep it.`,
  },
  {
    id: "card",
    label: "card",
    defaultAccent: "#1F6F6B",
    blurb: "clean panels on a tinted page, modern service look",
    suits: ["business", "sports", "community", "landing", "church", "fundraiser"],
    fonts: { display: "Sora", body: "Inter", weights: "Sora:wght@500;600;700&family=Inter:wght@400;500;600" },
    preview: { heroAlign: "center", displayFamily: "Helvetica, Arial, sans-serif", displayWeight: 600, caps: false, radius: 14 },
    spec: `TEMPLATE: CARD. Contained panels floating on a tinted page. Friendly and organised.
- Display face Sora at 600, body Inter.
- The page background is the surface tint, and content sits inside panels filled with the lighter page background. This is the inverse of the usual arrangement and it is what gives this template its shape, so keep it consistent.
- Hero: a single large panel, radius 16px, with 3rem of internal padding, containing the headline at clamp(2rem,5vw,3rem), one line of copy and one button. If a photo exists it fills the top of that same panel with the corners clipped by overflow hidden.
- Every subsequent section is one panel or a row of equal panels, radius 14px, 1px border in the line color, shadow 0 1px 3px rgba(0,0,0,0.05). One radius value, one shadow value, used everywhere.
- Panels in a row must be equal height, so use CSS grid with align-items stretch, never floats or inline-block.
- Buttons radius 10px, solid accent, 14px 26px padding.
- Keep the panel count honest: four substantial panels beat nine thin ones, and a panel holding one sentence should be merged into its neighbour.`,
  },
  {
    id: "journal",
    label: "journal",
    defaultAccent: "#5E3350",
    blurb: "narrow column, serif body, personal and written",
    suits: ["personal", "portfolio", "fundraiser", "community", "landing"],
    fonts: { display: "Instrument Serif", body: "Lora", weights: "Instrument+Serif&family=Lora:ital,wght@0,400;0,500;1,400" },
    preview: { heroAlign: "left", displayFamily: "Times New Roman, serif", displayWeight: 400, caps: false, radius: 3 },
    spec: `TEMPLATE: JOURNAL. Something written by a person, not published by a company.
- Display face Instrument Serif, body Lora. A serif body is the point here; it is what makes the page read as writing.
- Hero: left-aligned, narrow. Headline at clamp(2rem,4.5vw,3rem) in the display face, one line beneath in italic Lora at 1.125rem in muted ink.
- The whole page is one column at max-width 60ch, aligned left with margin-inline auto, on the page background. Photos are allowed to break out wider than the text column, to max-width 900px, which is the only place the layout widens.
- Body copy at 1.125rem, line-height 1.7, with real paragraph spacing of 1.25em and no first-line indents.
- Section headings at 1.5rem in the display face with 3.5rem of space above and 1rem below.
- The accent shows up on links (underlined, 1px, offset 3px) and nowhere else except one button if the page needs one.
- Corner radius 3px. No cards, no panels, no shadows, no borders except under links.`,
  },
];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

export function templateById(id: string | null | undefined): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Templates that suit a site type first, then the rest. */
export function templatesFor(siteType: string | null | undefined): Template[] {
  if (!siteType) return TEMPLATES;
  const fits = TEMPLATES.filter((t) => t.suits.includes(siteType));
  const rest = TEMPLATES.filter((t) => !t.suits.includes(siteType));
  return [...fits, ...rest];
}

// ---------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------

/** What onboarding decides and the project stores. */
export type DesignChoice = {
  template: string;
  accent: string;
  second?: string | null;
  dark?: boolean;
};

export function isDesignChoice(v: unknown): v is DesignChoice {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return typeof d.template === "string" && typeof d.accent === "string";
}

/**
 * Turns the two onboarding choices into the exact block the model gets.
 *
 * Every value here is final. There is nothing for the model to decide about
 * color, and nothing it can pick badly.
 */
export function designBrief(choice: DesignChoice): string {
  const template = templateById(choice.template) ?? TEMPLATES[0];
  const p = derivePalette(choice.accent, choice.second, choice.dark);

  const tintLines = p.tint
    ? `  --tint: ${p.tint};        /* second color, section backgrounds ONLY */
  --tint-ink: ${p.tintInk};   /* text on --tint */`
    : "";

  return `DESIGN BRIEF. These decisions are already made. Use these exact values and do not substitute your own.

PALETTE. Put these in :root verbatim, as custom properties, and reference them by variable everywhere else. Never write a raw hex anywhere but this block.
:root {
  --bg: ${p.bg};          /* page background */
  --surface: ${p.surface};     /* alternating section background */
  --ink: ${p.ink};         /* body and heading text */
  --ink-soft: ${p.inkSoft};    /* secondary and supporting text */
  --line: ${p.line};        /* borders and rules */
  --accent: ${p.accent};      /* solid fills and buttons */
  --accent-ink: ${p.accentInk};  /* text on top of --accent */
  --accent-text: ${p.accentText}; /* the accent used AS text or a link */
${tintLines}
}
- ${p.dark ? "This is a dark page. The background is a warm near-black, never navy or purple-black." : "This is a light page."}
- Accent rules: --accent is for solid fills and buttons. When the accent is text or a link, use --accent-text instead, which is the same color corrected for contrast. Getting these two the wrong way round is the most common way a page becomes unreadable.
- The accent appears fewer than about five times on the page. ${p.tint ? "--tint is a section background and small details only. It is never a second button color and never competes with the accent." : "There is no second accent color."}
- These colors already pass contrast. Do not "improve" them, tint them, add opacity to text colors, or introduce a color that is not in this block.

TYPOGRAPHY. Load exactly these two families and no others:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${template.fonts.weights}&display=swap" rel="stylesheet">
- Display face: ${template.fonts.display}, headings only.
- Body face: ${template.fonts.body}, everything else.
- Set both as custom properties (--font-display, --font-body) with a real fallback stack after each.

${template.spec}

Follow the template above the way you would follow a spec from a designer: the numbers in it are the numbers, not suggestions. Where it does not mention something, fall back to the general craft rules.`;
}
