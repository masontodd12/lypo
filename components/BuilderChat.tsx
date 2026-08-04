"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { INTERVIEWS, INTERVIEW, type Question } from "@/lib/interviews";
import { ThemeToggle } from "@/components/ThemeToggle";

type Message = { role: "user" | "assistant"; content: string };

const MIN_WORDS = 200;

/** A real checkbox underneath, so it is keyboard and screen-reader native. */
function Switch({
  on,
  onChange,
  disabled = false,
  label,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label
      className={`inline-flex shrink-0 items-center ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-flame ${
          on ? "bg-flame" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}

function SettingRow({
  title,
  body,
  control,
}: {
  title: string;
  body: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-paper p-4">
      <div className="min-w-0">
        <p className="font-display text-sm font-semibold tracking-tight">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{body}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

const STYLES = [
  { id: "minimal", label: "minimal", blurb: "clean, airy, lots of white space", colors: ["#FFFFFF", "#F2F2F0", "#1A1A1A"], font: "font-sans", prompt: "Style: ultra-minimal. Generous white space, warm off-white background, one restrained accent used fewer than three times, elegant typography, no decoration." },
  { id: "bold", label: "bold", blurb: "big type, one strong color, loud energy", colors: ["#FF3B30", "#FFF8F0", "#111111"], font: "font-sans font-extrabold", prompt: "Style: bold and confident. Heavy display type (Archivo Black or Anton), large scale, high contrast, ONE saturated accent color used on large surfaces. Solid colors only, no gradients, no second accent." },
  { id: "warm", label: "warm", blurb: "cozy, earthy, soft and inviting", colors: ["#FFF4E6", "#D9A066", "#5A3E28"], font: "font-serif", prompt: "Style: warm and inviting. Soft earthy palette, rounded corners, friendly humanist type, cozy community feel. One accent only." },
  { id: "elegant", label: "elegant", blurb: "refined, serif, quiet luxury", colors: ["#F7F5F1", "#C9B896", "#22201C"], font: "font-serif italic", prompt: "Style: elegant and refined. Sophisticated serif display type (Fraunces or Instrument Serif), muted palette of cream and charcoal with one quiet accent, generous line-height, lots of restraint." },
  { id: "playful", label: "playful", blurb: "rounded, fun, full of personality", colors: ["#FDFCFA", "#FF8552", "#22201C"], font: "font-sans", prompt: "Style: playful and fun. Rounded shapes, bouncy friendly feel, varied type sizes, one bright accent color. Solid colors only, no gradients, no neon." },
  { id: "dark", label: "dark", blurb: "moody, warm dark, high contrast", colors: ["#14110F", "#28221E", "#E8A87C"], font: "font-mono", prompt: "Style: dark and moody. Warm near-black background (#14110F, never navy or purple-black), high contrast text, one warm accent. No glow effects, no neon, no gradients." },
  { id: "retro", label: "retro", blurb: "vintage colors, nostalgic charm", colors: ["#F4E1C6", "#E76F51", "#2A9D8F"], font: "font-serif", prompt: "Style: retro vintage. 70s-inspired cream background, chunky type, nostalgic charm, burnt orange OR teal as the single accent, not both." },
  { id: "editorial", label: "editorial", blurb: "magazine layout, strong typography", colors: ["#FFFFFF", "#111111", "#D62828"], font: "font-serif font-bold", prompt: "Style: editorial magazine. Strong typographic hierarchy with a serif display face, grid-based layout, black and white with one red accent, feels like a beautiful publication." },
  { id: "organic", label: "organic", blurb: "natural greens, calm and grounded", colors: ["#F1F5EC", "#7CA982", "#2F3E2F"], font: "font-sans", prompt: "Style: organic and natural. Soft warm neutrals with muted green as the single accent, gentle curves, calm grounded feeling." },
];



// A menu is either a section heading or an item with a price.
type MenuRow =
  | { kind: "section"; label: string }
  | { kind: "item"; name: string; price: string };

// ---- paste-a-menu parser -------------------------------------------------
// Most restaurants already have their menu typed somewhere. This turns a
// pasted blob into editable rows. It gets most of it right; the grid is
// there so the owner can fix whatever it misses.
const PRICE_RE =
  /\$\s?\.?\d[\d,]*(?:\.\d{1,2})?(?:\s*\/\s*\$?\s?\.?\d[\d,]*(?:\.\d{1,2})?)*/;
const MENU_JUNK_RE =
  /^(\*+|copyright.*|powered by.?|this website uses cookies.?|we use cookies.*|accept|order online|order now|home|menu|our menu|full menu|welcome|gift cards|contact|contact us|about|about us|hours|location|cart|sign in|log in|search|follow us)$/i;
// Words that almost always end a section heading rather than an item name.
const SECTION_WORD =
  /(sauces|seasonings|flavors|flavours|sides|drinks|beverages|desserts|extras|toppings|combos|plates|platters|entrees|appetizers|starters|wings|specials|salads|sandwiches|burgers|tacos|soups|baskets|dinners|meals|breakfast|lunch|dinner|catering)$/i;

export function parseMenuText(raw: string): MenuRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"))
    .map((l) => l.replace(/^[\s*\-–—•·]+/, "").trim())
    .map((l) => l.replace(/\s{2,}/g, " "))
    .filter(Boolean)
    .filter((l) => !/^https?:\/\//i.test(l))
    .filter((l) => !MENU_JUNK_RE.test(l));

  const priceOf = (l: string) => l.match(PRICE_RE);
  const isPriceOnly = (l: string) => {
    const m = priceOf(l);
    return (
      !!m && l.slice(0, m.index).replace(/[\s\-–—:.]+$/, "").trim() === ""
    );
  };
  const MAX_NAME = 45;

  const rows: MenuRow[] = [];
  let pending: string | null = null;
  let inRun = false;
  const flush = () => {
    if (pending) {
      rows.push({ kind: "item", name: pending, price: "" });
      pending = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = priceOf(line);

    // "Wings $12.99", or a bare "$12.99" belonging to the line above
    if (m) {
      const price = m[0].replace(/\s+/g, "");
      const name = line
        .slice(0, m.index)
        .replace(/[\s\-–—:.]+$/, "")
        .trim();
      if (name) {
        flush();
        rows.push({ kind: "item", name, price });
      } else if (pending) {
        rows.push({ kind: "item", name: pending, price });
        pending = null;
      }
      inRun = false;
      continue;
    }

    // Bare text with a price on the next line is an item name.
    if (i + 1 < lines.length && isPriceOnly(lines[i + 1])) {
      flush();
      pending = line;
      inRun = false;
      continue;
    }

    // Long bare text with no price is prose, not a menu item.
    if (line.length > MAX_NAME) {
      flush();
      inRun = false;
      continue;
    }

    // Short bare lines: the first heads the run, the rest are items.
    flush();
    if (!inRun || SECTION_WORD.test(line)) {
      rows.push({ kind: "section", label: line });
      inRun = true;
    } else {
      rows.push({ kind: "item", name: line, price: "" });
    }
  }
  flush();

  // Drop empty sections and sections not followed by an item.
  return rows.filter((r, i) => {
    if (r.kind === "item") return r.name.trim() !== "";
    if (r.label.trim() === "") return false;
    const next = rows[i + 1];
    return !!next && next.kind === "item";
  });
}

// The reverse of serializeMenu. The paste-everything extractor returns the
// menu in the same "item | price" text form, so this turns it back into rows
// the owner can edit in the grid.
export function deserializeMenu(text: string): MenuRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): MenuRow => {
      const section = line.match(/^\[(.*)\]$/);
      if (section) return { kind: "section", label: section[1].trim() };
      const [name, ...rest] = line.split("|");
      const price = rest.join("|").trim();
      return {
        kind: "item",
        name: name.trim(),
        price: /no price given/i.test(price) ? "" : price.replace(/^\$/, ""),
      };
    })
    .filter((r) => (r.kind === "item" ? r.name !== "" : r.label !== ""));
}

// ---- manual hours entry --------------------------------------------------
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type HourRow = { day: (typeof DAYS)[number]; open: string; close: string; closed: boolean };

function emptyHours(): HourRow[] {
  return DAYS.map((day) => ({ day, open: "", close: "", closed: false }));
}

// <input type="time"> speaks 24-hour "HH:MM"; a customer reading the site
// wants "11:00 AM", so convert on the way out and back on the way in.
function to12h(v: string): string {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return v;
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m[2]} ${suffix}`;
}

function to24h(v: string): string {
  const m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?$/);
  if (!m) return /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : "";
  let h = Number(m[1]) % 12;
  if (/[Pp]/.test(m[3])) h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

// Only days the owner actually set anything for go out. A day left
// untouched is unknown, not closed, so it is omitted rather than guessed.
function serializeHours(rows: HourRow[]): string {
  return rows
    .filter((r) => r.closed || (r.open.trim() && r.close.trim()))
    .map((r) =>
      r.closed
        ? `${r.day}: Closed`
        : `${r.day}: ${to12h(r.open.trim())} - ${to12h(r.close.trim())}`,
    )
    .join("\n");
}

// The reverse of serializeHours. Best-effort: lines that match "Day: ..."
// populate that day's row, anything else is left for the owner to redo.
function deserializeHours(text: string): HourRow[] {
  const rows = emptyHours();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const day = DAYS.find((d) => d.toLowerCase() === m[1].trim().toLowerCase());
    if (!day) continue;
    const rest = m[2].trim();
    const row = rows.find((r) => r.day === day)!;
    if (/^closed$/i.test(rest)) {
      row.closed = true;
      continue;
    }
    const range = rest.split(/\s*(?:[-–—]|to)\s*/i);
    row.open = to24h(range[0]?.trim() ?? "");
    row.close = to24h(range[1]?.trim() ?? "");
  }
  return rows;
}

// Purpose modes: each maps to a server-side block in /api/generate that
// pre-loads the sections this kind of site actually needs.
const SITE_TYPES = [
  { id: "fundraiser", label: "fundraiser", blurb: "raise money for a person or cause", hint: "a fundraiser page" },
  { id: "memorial", label: "memorial", blurb: "honor someone, share service details", hint: "a memorial page" },
  { id: "church", label: "church / worship", blurb: "service times, visitors, giving", hint: "a church website" },
  { id: "barbershop", label: "barbershop / salon", blurb: "services, prices, booking, your work", hint: "a barbershop or salon website" },
  { id: "restaurant", label: "restaurant", blurb: "story, menu page, hours, logo", hint: "a restaurant website" },
  { id: "foodtruck", label: "food truck", blurb: "menu, location, hours", hint: "a food truck website" },
  { id: "sports", label: "youth sports team", blurb: "roster, schedule, signups", hint: "a youth sports team website" },
  { id: "business", label: "small business", blurb: "services, hours, contact", hint: "a small business website" },
  { id: "event", label: "event", blurb: "invite people and collect RSVPs", hint: "an event website with an RSVP form" },
  { id: "portfolio", label: "portfolio", blurb: "show off your work, art, photos", hint: "a personal portfolio website" },
  { id: "community", label: "community group", blurb: "bring your club or block together", hint: "a community group website" },
  { id: "landing", label: "idea launch", blurb: "a landing page for your next big thing", hint: "a landing page for an idea" },
  { id: "shop", label: "shop preview", blurb: "show your products beautifully", hint: "a product showcase site" },
];

export function BuilderChat({
  initialPages,
  initialMultiPage,
  projectId,
  initialIdea,
  initialHtml,
  initialMessages,
  initialName,
  initialKind,
  initialLogo,
  initialPaymentsEnabled,
  stripeConnected,
}: {
  initialPages: Record<string, string> | null;
  initialMultiPage: boolean;
  projectId: string;
  initialIdea: string | null;
  initialHtml: string | null;
  initialMessages: Message[];
  initialName: string;
  initialKind: string | null;
  initialLogo: string | null;
  initialPaymentsEnabled: boolean;
  /** Whether the account has Stripe connected at all. */
  stripeConnected: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [html, setHtml] = useState(initialHtml ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"preview" | "code" | "settings">("preview");
  const [paymentsEnabled, setPaymentsEnabled] = useState(initialPaymentsEnabled);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [step, setStep] = useState<
    | "setup"
    | "type"
    | "vibe"
    | "how"
    | "paste"
    | "review"
    | "describe"
    | "photos"
    | "build"
  >(initialHtml ? "build" : "setup");
  const [siteType, setSiteType] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(
    initialName === "untitled" ? "" : initialName,
  );
  const [kind, setKind] = useState<string>(initialKind ?? "website");
  const [vibe, setVibe] = useState<string | null>(null);
  const [description, setDescription] = useState(initialIdea ?? "");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [logo, setLogo] = useState<string | null>(initialLogo ?? null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([
    { kind: "section", label: "" },
    { kind: "item", name: "", price: "" },
  ]);
  const [hoursRows, setHoursRows] = useState<HourRow[]>(emptyHours());
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteNote, setPasteNote] = useState("");

  // ---- paste-everything path ----
  const [dump, setDump] = useState("");
  const [dumpBusy, setDumpBusy] = useState(false);
  const [dumpError, setDumpError] = useState("");
  const [guessed, setGuessed] = useState<number[]>([]);
  const [leftover, setLeftover] = useState("");
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  function applyPastedMenu() {
    const parsed = parseMenuText(pasteText);
    if (parsed.length === 0) {
      setPasteNote("Couldn't find any items in that. Try including prices.");
      return;
    }
    const items = parsed.filter((r) => r.kind === "item").length;
    const sections = parsed.filter((r) => r.kind === "section").length;
    setMenuRows(parsed);
    setPasting(false);
    setPasteText("");
    setPasteNote(
      `Found ${items} item${items === 1 ? "" : "s"} in ${sections} section${sections === 1 ? "" : "s"}. Check it over and fix anything that landed wrong.`,
    );
  }

  const filledMenu = menuRows.filter((r) =>
    r.kind === "item" ? r.name.trim() !== "" : r.label.trim() !== "",
  );

  // Turn the rows into something unambiguous for the generator.
  function serializeMenu(rows: MenuRow[]): string {
    return rows
      .map((r) =>
        r.kind === "section"
          ? r.label.trim()
            ? `\n[${r.label.trim()}]`
            : ""
          : r.name.trim()
            ? `${r.name.trim()} | ${
                r.price.trim()
                  ? /^[\d.,]+$/.test(r.price.trim())
                    ? `$${r.price.trim()}`
                    : r.price.trim()
                  : "NO PRICE GIVEN"
              }`
            : "",
      )
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function updateRow(i: number, patch: Partial<MenuRow>) {
    setMenuRows((prev) =>
      prev.map((r, idx) => (idx === i ? ({ ...r, ...patch } as MenuRow) : r)),
    );
  }

  // Which interview to run. Restaurants get restaurant questions.
  const interview: Question[] = INTERVIEWS[siteType ?? ""] ?? INTERVIEW;
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const buildStart = useRef<number | null>(null);
  const [buildSeconds, setBuildSeconds] = useState<number | null>(null);
  // A multi-page site is generated one page at a time. Nothing is shown
  // until every page is finished, so the preview never flashes a
  // half-built site or an empty page that is still being written.
  const [initialBuilding, setInitialBuilding] = useState(false);
  const [buildPhase, setBuildPhase] = useState<string | null>(null);
  const [buildTotal, setBuildTotal] = useState(0);
  const [buildDone, setBuildDone] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [picked, setPicked] = useState<{ tag: string; text: string } | null>(null);
  const [multiPage, setMultiPage] = useState(initialMultiPage);
  const [pages, setPages] = useState<Record<string, string>>(
    initialPages ?? (initialHtml ? { home: initialHtml } : {}),
  );
  const [currentPage, setCurrentPage] = useState("home");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<
    { id: string; summary: string | null; created_at: string }[]
  >([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [roasting, setRoasting] = useState(false);

  async function openHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    setHistoryBusy(true);
    try {
      const res = await fetch(
        `/api/versions?projectId=${projectId}&page=${currentPage}`,
      );
      if (!res.ok) throw new Error("history request failed");
      const data = await res.json();
      setVersions(data.versions ?? []);
      setHistoryError("");
    } catch {
      setVersions([]);
      // Distinguish "couldn't load" from "nothing saved yet", so a failed
      // request doesn't read as lost history.
      setHistoryError("Couldn't load your history. Try again in a moment.");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function restoreVersion(versionId: string) {
    if (busy || historyBusy) return;
    setHistoryBusy(true);
    try {
      const res = await fetch("/api/versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, versionId }),
      });
      const data = await res.json();
      if (res.ok) {
        const restoredPage: string = data.page ?? currentPage;
        setPages((prev) => ({ ...prev, [restoredPage]: data.html }));
        // Show the page that was actually restored, so the markup on screen
        // always belongs to the tab that is selected.
        setCurrentPage(restoredPage);
        setHtml(data.html);
        setShowHistory(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Restored an earlier version." },
        ]);
      } else {
        setError(data.error ?? "Couldn't restore that version.");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function roast() {
    if (busy || roasting || !html) return;
    setRoasting(true);
    setError("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "roast my site" },
    ]);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, page: currentPage }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.roast },
        ]);
      } else {
        setError(data.error ?? "The roast fell flat.");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch {
      setError("Couldn't reach the server.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setRoasting(false);
    }
  }

  function downloadHtml() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "site").replace(/[^a-zA-Z0-9-_]+/g, "-")}${
      currentPage === "home" ? "" : `-${currentPage}`
    }.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleMultiPage() {
    const next = !multiPage;
    setMultiPage(next);
    setSettingsBusy(true);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("projects")
        .update({ multi_page: next })
        .eq("id", projectId);
      // Put the switch back rather than showing a setting that did not save.
      if (dbError) {
        setMultiPage(!next);
        setError("Couldn't save that setting. Try again.");
      }
    } finally {
      setSettingsBusy(false);
    }
  }

  async function togglePayments() {
    if (!stripeConnected) return;
    const next = !paymentsEnabled;
    setPaymentsEnabled(next);
    setSettingsBusy(true);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("projects")
        .update({ payments_enabled: next })
        .eq("id", projectId);
      if (dbError) {
        setPaymentsEnabled(!next);
        setError("Couldn't save that setting. Try again.");
      }
    } finally {
      setSettingsBusy(false);
    }
  }

  // Mirrors currentPage so an in-flight generation can tell whether the
  // user has since switched pages, without reading a stale closure.
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  function switchPage(name: string) {
    setCurrentPage(name);
    setHtml(pages[name] ?? "");
    setPicked(null);
  }

  async function addPage() {
    const raw = prompt(
      "Name the new page (like about, menu, contact):",
    );
    if (!raw) return;
    const name = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").slice(0, 24);
    if (!name || pages[name] !== undefined) return;
    setPages((prev) => ({ ...prev, [name]: "" }));
    setCurrentPage(name);
    setHtml("");
    const built = await generate(
      `Create the "${name}" page for this site. Match the existing style exactly and include the shared nav.`,
      undefined,
      name,
    );
    // A failed page would otherwise sit in the nav forever as a blank tab.
    if (!built) {
      setPages((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setCurrentPage("home");
      setHtml(pages.home ?? "");
    }
  }

  // ---- #1 voice: dictate into any setter ----
  function dictate(onText: (t: string) => void) {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };
    const SR = w.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input needs Chrome or Edge. Type it instead for now.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onText(e.results[i][0].transcript + " ");
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  // ---- #3 live edit: receive picks from preview ----
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.lypoPick) setPicked(e.data.lypoPick);
      if (e.data?.lypoNavigate && typeof e.data.lypoNavigate === "string") {
        const target = e.data.lypoNavigate;
        setCurrentPage(target);
        setHtml((prev) => prev); // no-op guard
        setPages((prev) => {
          setHtml(prev[target] ?? "");
          return prev;
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const NAV_SCRIPT = `<script>
document.addEventListener("click", function (e) {
  var link = e.target.closest && e.target.closest("[data-lypo-page]");
  if (!link) return;
  e.preventDefault(); e.stopPropagation();
  parent.postMessage({ lypoNavigate: link.getAttribute("data-lypo-page") }, "*");
}, true);
<\/script>`;

  const EDIT_SCRIPT = `<script>
document.addEventListener("click", function (e) {
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll("[data-lypo-picked]").forEach(function (n) {
    n.removeAttribute("data-lypo-picked"); n.style.outline = "";
  });
  var el = e.target;
  el.setAttribute("data-lypo-picked", "1");
  el.style.outline = "3px solid #e8542f";
  el.style.outlineOffset = "2px";
  parent.postMessage({ lypoPick: {
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || "").trim().slice(0, 120)
  }}, "*");
}, true);
<\/script>`;

  // Whether anything has finished building yet. Drives whether the preview
  // shows the site or a waiting state, so an unbuilt page never renders as
  // a blank white iframe.
  const hasSite = Object.values(pages).some(
    (p) => typeof p === "string" && p.trim() !== "",
  );

  const injectedScripts = NAV_SCRIPT + (editMode ? EDIT_SCRIPT : "");
  const previewHtml = html
    ? html.includes("</body>")
      ? html.replace("</body>", injectedScripts + "</body>")
      : html + injectedScripts
    : html;

  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  // Convert any image (including iPhone HEIC) to a browser-friendly JPEG,
  // and downscale very large photos so uploads stay fast.
  async function toWebFriendlyJpeg(file: File): Promise<File> {
    let working = file;

    // Step 1: HEIC/HEIF -> JPEG (browsers cannot render HEIC)
    const isHeic =
      /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (isHeic) {
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = (await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        })) as Blob;
        working = new File(
          [converted],
          file.name.replace(/\.[^.]+$/, ".jpg"),
          { type: "image/jpeg" },
        );
      } catch {
        // If conversion fails, fall through and try the canvas path below
      }
    }

    // Step 2: downscale + re-encode to JPEG via canvas (caps huge photos)
    try {
      const bitmap = await createImageBitmap(working);
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return working;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.88),
      );
      if (!blob) return working;
      return new File([blob], working.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
      });
    } catch {
      return working;
    }
  }

  // Logo is kept separate from photos. It belongs in the header on every
  // page, not in a gallery, so it gets its own slot and its own instruction.
  async function uploadLogo(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLogoBusy(true);
    setError("");
    try {
      let file = files[0];
      try {
        file = await toWebFriendlyJpeg(file);
      } catch {
        // keep original if conversion throws
      }
      const supabase = createClient();
      const path = `${projectId}/logo-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (uploadError) {
        setError(`Logo upload failed: ${uploadError.message}`);
        return;
      }
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      if (data?.publicUrl) {
        setLogo(data.publicUrl);
        // Persist so later edits and reloads keep the logo.
        await supabase
          .from("projects")
          .update({ logo_url: data.publicUrl })
          .eq("id", projectId);
      }
    } finally {
      setLogoBusy(false);
    }
  }

  async function clearLogo() {
    setLogo(null);
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ logo_url: null })
      .eq("id", projectId);
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    const supabase = createClient();

    for (const original of Array.from(files)) {
      let file = original;
      try {
        file = await toWebFriendlyJpeg(original);
      } catch {
        // keep original if conversion throws
      }

      const path = `${projectId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from("uploads").getPublicUrl(path);
      if (data?.publicUrl) setPhotos((prev) => [...prev, data.publicUrl]);
    }
    setUploading(false);
  }

  async function generate(
    message: string,
    imageUrls?: string[],
    pageOverride?: string,
    /**
     * Store the result without showing it. Used while a multi-page site is
     * still being built, so the preview only ever flips once, at the end.
     */
    silent = false,
  ): Promise<string | null> {
    const targetPage = pageOverride ?? currentPage;
    setBusy(true);
    setError("");
    if (!silent && !html) buildStart.current = Date.now();
    let finalMessage = message;
    if (picked) {
      finalMessage = `The user clicked this element on the page: <${picked.tag}> containing "${picked.text}". Apply the following change to that specific element (and only it unless asked otherwise): ${message}`;
      setPicked(null);
      setEditMode(false);
    }
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: finalMessage,
          imageUrls,
          page: targetPage,
          purpose: siteType ?? undefined,
          logoUrl: logo ?? undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setMessages((prev) => prev.slice(0, -1));
      } else {
        setPages((prev) => ({ ...prev, [targetPage]: data.html }));
        if (!silent) {
          if (!html && buildStart.current) {
            setBuildSeconds(
              Math.round((Date.now() - buildStart.current) / 1000),
            );
            buildStart.current = null;
          }
          // If the user switched pages while this was in flight, the result
          // still belongs to targetPage. Showing it now would put another
          // page's markup under the tab they are actually looking at.
          if (targetPage === currentPageRef.current) {
            setHtml(data.html);
            setTab("preview");
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.summary },
        ]);
        return data.html as string;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
    return null;
  }

  // Purposes that ship as a real multi-page site instead of one scroll.
  const MULTI_PAGE_PURPOSES: Record<string, string[]> = {
    restaurant: ["menu"],
  };

  async function startBuild() {
    const style = STYLES.find((s) => s.id === vibe);
    if (!style) return;
    setStep("build");
    const typeHint = SITE_TYPES.find((t) => t.id === siteType)?.hint;
    const photoNote =
      photos.length > 0
        ? ` Use these uploaded photos in the design (as <img> tags with these exact URLs): ${photos.join(" , ")}`
        : "";
    // The logo instruction is added server-side from logoUrl, so it applies
    // to every later edit too, not just this first build.

    const extraPages = MULTI_PAGE_PURPOSES[siteType ?? ""] ?? [];

    // Multi-page purposes need the flag set before the first build so the
    // generator writes nav links instead of section anchors.
    if (extraPages.length > 0 && !multiPage) {
      setMultiPage(true);
      const supabase = createClient();
      await supabase
        .from("projects")
        .update({ multi_page: true })
        .eq("id", projectId);
    }

    const kindNote =
      kind === "webapp"
        ? "This is a WEB APP: an interactive single-page tool with working JavaScript functionality, not a brochure site."
        : extraPages.length > 0
          ? `This is a MULTI-PAGE WEBSITE. You are building the HOME page. The site also has these pages: ${extraPages.join(", ")}. Include a header nav linking to every page.`
          : "This is a WEBSITE: a single-page site with NO navigation tabs or menu links at the top, one continuous scrolling page.";

    // Every page is generated before anything is revealed, so the user
    // never sees a half-built site or a page that is still being written.
    const started = Date.now();
    setInitialBuilding(true);
    setBuildTotal(1 + extraPages.length);
    setBuildDone(0);
    setBuildPhase("home");

    try {
      const homeHtml = await generate(
        `${kindNote} ${typeHint ? `Build ${typeHint}. ` : ""}${description.trim()} ${style.prompt}${photoNote}`,
        undefined,
        "home",
        true,
      );

      // Home failed. generate() already surfaced the error, and there is
      // nothing to match the extra pages against, so stop here.
      if (!homeHtml) return;
      setBuildDone(1);

      const failed: string[] = [];
      for (const page of extraPages) {
        setBuildPhase(page);
        const built = await generate(
          `Create the "${page}" page for this site. Match the home page's style, fonts, colors, header, and nav exactly.${
            page === "menu"
              ? " Lay out the full menu using the items and prices the owner gave, grouped into clear sections with real headings. Prices right-aligned or clearly separated from item names. No invented items, no invented prices. If they did not give a price for something, leave the price off rather than guessing."
              : ""
          }`,
          undefined,
          page,
          true,
        );
        if (!built) failed.push(page);
        setBuildDone((n) => n + 1);
      }

      // Reveal the finished site in one step.
      setCurrentPage("home");
      setHtml(homeHtml);
      setTab("preview");
      setBuildSeconds(Math.round((Date.now() - started) / 1000));

      if (failed.length > 0) {
        setError(
          `Your home page is ready, but the ${failed.join(" and ")} page${
            failed.length === 1 ? "" : "s"
          } did not build. Ask for it again and it will retry.`,
        );
      }
    } finally {
      setInitialBuilding(false);
      setBuildPhase(null);
    }
  }

  function restyle(styleId: string) {
    const style = STYLES.find((s) => s.id === styleId);
    if (!style || busy) return;
    generate(`Redesign the current page. ${style.prompt} Keep all the content and photos.`);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || busy) return;
    setInput("");
    generate(value);
  }

  // ---------- STEP -1: name it + pick kind ----------
  async function saveSetup() {
    const name = projectName.trim() || "untitled";
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ name, kind })
      .eq("id", projectId);
    setStep("type");
  }

  if (step === "setup") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          what is it called<span className="text-flame">?</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          The name of your business, organization, or project. You can change
          it later.
        </p>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Riverside Barbershop"
          aria-label="Project name"
          className="mt-5 w-full border-b-2 border-ink bg-transparent py-3 text-lg outline-none placeholder:text-faint focus:border-flame"
        />

        <p className="font-display mt-12 text-xl font-semibold tracking-tight">
          what are you building<span className="text-flame">?</span>
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setKind("website")}
            className={`rounded-xl border p-5 text-left transition ${
              kind === "website"
                ? "border-flame bg-paper"
                : "border-line bg-paper hover:border-flame"
            }`}
          >
            <p className="font-display font-semibold">
              website<span className="text-flame">.</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              A site customers can find, with your story, hours, prices, and a
              way to reach you.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setKind("webapp")}
            className={`rounded-xl border p-5 text-left transition ${
              kind === "webapp"
                ? "border-flame bg-paper"
                : "border-line bg-paper hover:border-flame"
            }`}
          >
            <p className="font-display font-semibold">
              web app<span className="text-flame">.</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              An interactive tool such as a calculator, tracker, or quiz.
              Something people use, not just read.
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={saveSetup}
          className="mt-10 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright"
        >
          next →
        </button>
      </div>
    );
  }

  // ---------- STEP 0: what are we making ----------
  if (step === "type") {
    return (
      <div className="flex flex-1 flex-col items-center overflow-y-auto p-8">
        <button
          type="button"
          onClick={() => setStep("setup")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <p className="font-display mt-4 text-3xl font-semibold tracking-tight">
          what kind of business<span className="text-flame">?</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          This determines what we ask you next and which sections your site
          gets. Pick the closest match.
        </p>
        <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {SITE_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setSiteType(type.id);
                setStep("vibe");
              }}
              className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-flame"
            >
              <p className="font-display font-semibold">
                {type.label}
                <span className="text-flame">.</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {type.blurb}
              </p>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-faint">
          Not seeing yours? Pick the closest match. You can change anything
          after it builds.
        </p>
      </div>
    );
  }

  // ---------- STEP 1: pick a vibe ----------
  if (step === "vibe") {
    return (
      <div className="flex flex-1 flex-col items-center overflow-y-auto p-8">
        <button
          type="button"
          onClick={() => setStep("type")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back ({siteType})
        </button>
        <p className="font-display mt-4 text-3xl font-semibold tracking-tight">
          choose your look<span className="text-flame">.</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          This sets your colors and typography. You can change it at any point
          after your site is built.
        </p>
        <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setVibe(style.id);
                setStep("how");
              }}
              className="group rounded-xl border border-line bg-paper p-5 text-left transition hover:border-flame"
            >
              {/* mini example swatch */}
              <div
                className="flex h-20 flex-col justify-between rounded-lg p-3"
                style={{ background: style.colors[0] }}
              >
                <div
                  className="h-2 w-2/3 rounded-full"
                  style={{ background: style.colors[2] }}
                />
                <div className="flex gap-1.5">
                  <div
                    className="h-4 w-12 rounded"
                    style={{ background: style.colors[1] }}
                  />
                  <div
                    className="h-4 w-8 rounded"
                    style={{ background: style.colors[2], opacity: 0.7 }}
                  />
                </div>
              </div>
              <p className="font-display mt-4 font-semibold">
                {style.label}
                <span className="text-flame">.</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {style.blurb}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- STEP 2: lypo interviews you ----------

  // Both paths end here: the one-at-a-time interview and the paste-everything
  // review. Anything blank is left out rather than sent as an empty question,
  // so the generator never sees "when are you open" with nothing after it.
  function finishInterview(final: string[], extra = "") {
    const combined = interview
      .map((item, i) => {
        const answer = (final[i] ?? "").trim();
        if (!answer) return "";
        return item.kind === "menu"
          ? `THE MENU (each line is "item | price", [brackets] are section headings, use these exactly and invent nothing):\n${answer}`
          : `${item.q} ${answer}`;
      })
      .filter(Boolean)
      .join("\n\n");
    const tail = extra.trim() ? `\n\nalso worth knowing: ${extra.trim()}` : "";
    setDescription(`${initialIdea ? initialIdea + ". " : ""}${combined}${tail}`);
    setStep("photos");
  }

  function nextQuestion() {
    const updated = [...answers];
    updated[qIndex] =
      interview[qIndex]?.kind === "menu"
        ? serializeMenu(menuRows)
        : interview[qIndex]?.kind === "hours"
          ? serializeHours(hoursRows)
          : answerDraft.trim();
    setAnswers(updated);

    // Jumped in from the review screen to fix one answer. Go back there.
    if (reviewIndex !== null) {
      setReviewIndex(null);
      setStep("review");
      return;
    }

    setAnswerDraft(updated[qIndex + 1] ?? "");
    if (qIndex < interview.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      finishInterview(updated);
    }
  }

  function editAnswer(i: number) {
    setReviewIndex(i);
    setQIndex(i);
    setAnswerDraft(answers[i] ?? "");
    setStep("describe");
  }

  // Read the pasted blob into the same answer slots the interview would fill.
  async function readDump() {
    const text = dump.trim();
    if (text.length < 40 || dumpBusy) return;
    setDumpBusy(true);
    setDumpError("");
    try {
      const res = await fetch("/api/parse-intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, purpose: siteType ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDumpError(data.error ?? "Couldn't read that. Try again.");
        return;
      }
      const next: string[] = data.answers ?? [];
      setAnswers(next);
      setGuessed(data.guessed ?? []);
      setLeftover(data.leftover ?? "");

      const menuAt = interview.findIndex((item) => item.kind === "menu");
      if (menuAt >= 0 && next[menuAt]) {
        const rows = deserializeMenu(next[menuAt]);
        if (rows.length > 0) setMenuRows(rows);
      }

      const hoursAt = interview.findIndex((item) => item.kind === "hours");
      if (hoursAt >= 0 && next[hoursAt]) {
        setHoursRows(deserializeHours(next[hoursAt]));
      }

      setReviewIndex(null);
      setStep("review");
    } catch {
      setDumpError("Couldn't reach the server. Check your connection.");
    } finally {
      setDumpBusy(false);
    }
  }

  // ---------- STEP 1.5: questions, or paste it all ----------
  if (step === "how") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <button
          type="button"
          onClick={() => setStep("vibe")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight">
          how do you want to do this<span className="text-flame">?</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Same site either way. Pick whichever matches what you already have.
        </p>

        <div className="mt-6 grid gap-4">
          <button
            type="button"
            onClick={() => {
              setQIndex(0);
              setAnswerDraft(answers[0] ?? "");
              setStep("describe");
            }}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-flame"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-semibold">
                answer {interview.length} questions
                <span className="text-flame">.</span>
              </p>
              <span className="shrink-0 text-xs text-faint">a few minutes</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              One at a time, with a hint on each. Best if you are still working
              out what the site should say.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setDumpError("");
              setStep("paste");
            }}
            className="rounded-xl border border-line bg-paper p-5 text-left transition hover:border-flame"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-semibold">
                paste everything at once
                <span className="text-flame">.</span>
              </p>
              <span className="shrink-0 text-xs text-faint">about a minute</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Drop in your bio, your menu, an old About page, notes off your
              phone. We sort it into the answers and show you what we got.
            </p>
          </button>
        </div>

        <p className="mt-6 text-xs text-faint">
          Either way you get to check and fix everything before it builds.
        </p>
      </div>
    );
  }

  // ---------- STEP 1.6: the paste box ----------
  if (step === "paste") {
    const dumpLength = dump.trim().length;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <button
          type="button"
          onClick={() => setStep("how")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight">
          tell us everything<span className="text-flame">.</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Paste whatever you already have written down. It does not need to be
          organized and it does not need to be neat. We pull out what matters.
        </p>

        <ul className="mt-4 space-y-1 text-xs text-faint">
          {interview.map((item) => (
            <li key={item.q}>{item.q.replace(/\?$/, "")}</li>
          ))}
        </ul>

        <textarea
          value={dump}
          onChange={(e) => setDump(e.target.value)}
          rows={12}
          autoFocus
          aria-label="Everything about your business"
          placeholder={
            "Paste your Instagram bio, your menu, an old About page, notes from your phone. All of it, in any order."
          }
          className="mt-5 w-full resize-y rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed text-ink outline-none focus:border-flame"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => dictate((t) => setDump((prev) => prev + t))}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              listening
                ? "border-flame bg-flame text-paper"
                : "border-line text-ink-soft hover:border-flame hover:text-flame"
            }`}
          >
            {listening ? "listening, tap to stop" : "talk instead"}
          </button>
          <span className="text-xs text-faint">
            {dumpLength > 0 && dumpLength < 40
              ? "keep going"
              : dumpLength > 0
                ? `${dumpLength.toLocaleString()} characters`
                : ""}
          </span>
        </div>

        {dumpError && <p className="mt-4 text-sm text-flame">{dumpError}</p>}

        <button
          type="button"
          onClick={readDump}
          disabled={dumpLength < 40 || dumpBusy}
          className="mt-6 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          {dumpBusy ? "reading…" : "next →"}
        </button>
        <p className="mt-3 text-xs text-faint">
          Nothing gets built yet. You check it on the next screen.
        </p>
      </div>
    );
  }

  // ---------- STEP 1.7: check what we pulled out ----------
  if (step === "review") {
    const filled = answers.filter((a) => a?.trim()).length;
    const menuAt = interview.findIndex((item) => item.kind === "menu");
    const menuItems = filledMenu.filter((r) => r.kind === "item").length;
    const hoursAt = interview.findIndex((item) => item.kind === "hours");
    const daysSet = hoursRows.filter((r) => r.closed || r.open.trim() || r.close.trim()).length;

    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto p-8">
        <button
          type="button"
          onClick={() => setStep("paste")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <h2 className="font-display mt-6 text-3xl font-semibold tracking-tight">
          here is what we got<span className="text-flame">.</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {filled} of {interview.length} answered. Fix anything wrong and fill
          in what you want. Blanks are fine, we leave those sections off instead
          of making something up.
        </p>

        <div className="mt-6 space-y-5">
          {interview.map((item, i) => {
            const answer = answers[i] ?? "";
            const isMenu = item.kind === "menu";
            const isHours = item.kind === "hours";
            const wasGuessed = guessed.includes(i);

            return (
              <div key={item.q}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-sm font-semibold tracking-tight">
                    {item.q.replace(/\?$/, "")}
                  </p>
                  {wasGuessed ? (
                    <span className="shrink-0 text-xs text-flame">
                      we guessed this
                    </span>
                  ) : !answer.trim() ? (
                    <span className="shrink-0 text-xs text-faint">
                      not in what you pasted
                    </span>
                  ) : null}
                </div>

                {isMenu ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2.5">
                    <p className="text-sm text-ink-soft">
                      {menuItems > 0
                        ? `${menuItems} item${menuItems === 1 ? "" : "s"} found`
                        : "no menu items found"}
                    </p>
                    <button
                      type="button"
                      onClick={() => editAnswer(i)}
                      className="ml-auto shrink-0 text-xs font-medium text-flame hover:underline"
                    >
                      {menuItems > 0 ? "check the menu →" : "add your menu →"}
                    </button>
                  </div>
                ) : isHours ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2.5">
                    <p className="text-sm text-ink-soft">
                      {daysSet > 0
                        ? `${daysSet} day${daysSet === 1 ? "" : "s"} set`
                        : "no hours set"}
                    </p>
                    <button
                      type="button"
                      onClick={() => editAnswer(i)}
                      className="ml-auto shrink-0 text-xs font-medium text-flame hover:underline"
                    >
                      {daysSet > 0 ? "check the hours →" : "add your hours →"}
                    </button>
                  </div>
                ) : (
                  <textarea
                    value={answer}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    rows={item.long ? 6 : 2}
                    placeholder={item.hint}
                    aria-label={item.q}
                    className="mt-2 w-full resize-y rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-flame"
                  />
                )}
              </div>
            );
          })}
        </div>

        {leftover && (
          <div className="mt-5">
            <p className="font-display text-sm font-semibold tracking-tight">
              other things you mentioned
            </p>
            <textarea
              value={leftover}
              onChange={(e) => setLeftover(e.target.value)}
              rows={3}
              aria-label="Other things you mentioned"
              className="mt-2 w-full resize-y rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed outline-none focus:border-flame"
            />
            <p className="mt-1 text-xs text-faint">
              Delete anything you do not want on the site.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const final = [...answers];
            if (menuAt >= 0) final[menuAt] = serializeMenu(menuRows);
            if (hoursAt >= 0) final[hoursAt] = serializeHours(hoursRows);
            finishInterview(final, leftover);
          }}
          disabled={filled === 0}
          className="mt-8 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          looks right →
        </button>
        <p className="mt-3 pb-4 text-xs text-faint">
          You can change any of this after it builds, too.
        </p>
      </div>
    );
  }

  if (step === "describe") {
    const current = interview[qIndex];
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <button
          type="button"
          onClick={() => {
            if (reviewIndex !== null) {
              setReviewIndex(null);
              setStep("review");
            } else if (qIndex === 0) {
              setStep("how");
            } else {
              setQIndex(qIndex - 1);
              setAnswerDraft(answers[qIndex - 1] ?? "");
            }
          }}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <p className="mt-8 text-xs tracking-widest text-faint">
          {reviewIndex !== null
            ? "fixing one answer"
            : `${qIndex + 1} / ${interview.length}`}
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">
          {current.q}
          <span className="text-flame">.</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{current.hint}</p>

        {current.kind === "menu" ? (
          <div className="mt-6">
            {/* paste an existing menu instead of typing it */}
            {pasting ? (
              <div className="mb-5 rounded-xl border border-line bg-paper p-4">
                <p className="text-sm font-medium">paste your menu</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Copy it from your website, your online ordering page, or
                  anywhere you already have it typed. Prices can be on the same
                  line or the line below.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={9}
                  autoFocus
                  aria-label="Paste your existing menu"
                  placeholder={
                    "Combos\n3 PC Whole Wing Combo\n$11.99\n\nParty Wings\n10 PC Party Wings  $13.61"
                  }
                  className="mt-3 w-full resize-y rounded-lg border border-line bg-paper p-3 font-mono text-xs leading-relaxed outline-none focus:border-flame"
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={applyPastedMenu}
                    disabled={!pasteText.trim()}
                    className="rounded-full bg-flame px-5 py-2 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-40"
                  >
                    convert to list
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasting(false);
                      setPasteText("");
                      setPasteNote("");
                    }}
                    className="text-sm text-faint transition hover:text-flame"
                  >
                    cancel
                  </button>
                </div>
                {pasteNote && (
                  <p className="mt-2 text-xs text-flame">{pasteNote}</p>
                )}
              </div>
            ) : (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPasting(true);
                    setPasteNote("");
                  }}
                  className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame"
                >
                  paste an existing menu
                </button>
                <span className="text-xs text-faint">
                  Already have it typed somewhere? Paste it and we&apos;ll
                  build the list for you.
                </span>
              </div>
            )}
            {!pasting && pasteNote && (
              <p className="mb-3 text-xs text-ink-soft">{pasteNote}</p>
            )}

            <div className="space-y-2">
              {menuRows.map((row, i) =>
                row.kind === "section" ? (
                  <div key={i} className="flex items-center gap-2 pt-3">
                    <input
                      value={row.label}
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                      placeholder="section name (appetizers, plates, drinks)"
                      aria-label={`Section ${i + 1} name`}
                      className="font-display w-full border-b-2 border-ink bg-transparent py-1.5 text-sm font-semibold tracking-tight outline-none placeholder:font-normal placeholder:text-faint focus:border-flame"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMenuRows((prev) => prev.filter((_, x) => x !== i))
                      }
                      aria-label="Remove section"
                      className="shrink-0 px-1 text-xs text-faint transition hover:text-flame"
                    >
                      remove
                    </button>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      placeholder="item name"
                      aria-label={`Item ${i + 1} name`}
                      className="w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-flame"
                    />
                    <div className="flex w-28 shrink-0 items-center rounded-lg border border-line bg-paper px-2 focus-within:border-flame">
                      <span className="text-sm text-faint">$</span>
                      <input
                        value={row.price}
                        onChange={(e) => updateRow(i, { price: e.target.value })}
                        placeholder="12"
                        inputMode="decimal"
                        aria-label={`Item ${i + 1} price`}
                        className="w-full min-w-0 bg-transparent py-2 pl-1 text-sm outline-none placeholder:text-faint"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setMenuRows((prev) => prev.filter((_, x) => x !== i))
                      }
                      aria-label="Remove item"
                      className="shrink-0 px-1 text-xs text-faint transition hover:text-flame"
                    >
                      remove
                    </button>
                  </div>
                ),
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMenuRows((prev) => [
                    ...prev,
                    { kind: "item", name: "", price: "" },
                  ])
                }
                className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame"
              >
                + add item
              </button>
              <button
                type="button"
                onClick={() =>
                  setMenuRows((prev) => [
                    ...prev,
                    { kind: "section", label: "" },
                    { kind: "item", name: "", price: "" },
                  ])
                }
                className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame"
              >
                + add section
              </button>
              {filledMenu.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Clear the whole menu and start over?")) return;
                    setMenuRows([
                      { kind: "section", label: "" },
                      { kind: "item", name: "", price: "" },
                    ]);
                    setPasteNote("");
                  }}
                  className="ml-auto text-xs text-faint transition hover:text-flame"
                >
                  clear all
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-faint">
              Leave a price blank if it changes. We&apos;ll show the item
              without one instead of making a number up.
            </p>
          </div>
        ) : current.kind === "hours" ? (
          <div className="mt-6">
            <div className="space-y-2">
              {hoursRows.map((row, i) => (
                <div key={row.day} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm text-ink-soft">
                    {row.day}
                  </span>
                  {row.closed ? (
                    <span className="flex-1 text-sm text-faint">Closed</span>
                  ) : (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={row.open}
                        onChange={(e) =>
                          setHoursRows((prev) =>
                            prev.map((r, x) =>
                              x === i ? { ...r, open: e.target.value } : r,
                            ),
                          )
                        }
                        aria-label={`${row.day} opening time`}
                        className="w-full min-w-0 rounded-lg border border-line bg-paper px-2 py-2 text-sm outline-none focus:border-flame"
                      />
                      <span className="shrink-0 text-xs text-faint">to</span>
                      <input
                        type="time"
                        value={row.close}
                        onChange={(e) =>
                          setHoursRows((prev) =>
                            prev.map((r, x) =>
                              x === i ? { ...r, close: e.target.value } : r,
                            ),
                          )
                        }
                        aria-label={`${row.day} closing time`}
                        className="w-full min-w-0 rounded-lg border border-line bg-paper px-2 py-2 text-sm outline-none focus:border-flame"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setHoursRows((prev) =>
                        prev.map((r, x) =>
                          x === i
                            ? r.closed
                              ? { ...r, closed: false }
                              : { ...r, closed: true, open: "", close: "" }
                            : r,
                        ),
                      )
                    }
                    className="w-16 shrink-0 text-xs text-faint transition hover:text-flame"
                  >
                    {row.closed ? "set hours" : "closed"}
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const first = hoursRows.find((r) => !r.closed && r.open && r.close);
                if (!first) return;
                setHoursRows((prev) =>
                  prev.map((r) =>
                    r.closed ? r : { ...r, open: first.open, close: first.close },
                  ),
                );
              }}
              className="mt-4 rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame"
            >
              same hours every day
            </button>
            <p className="mt-3 text-xs text-faint">
              Leave a day blank if you are not sure yet. We leave it off the
              site instead of guessing.
            </p>
          </div>
        ) : (
          <>
            <textarea
              value={answerDraft}
              onChange={(e) => setAnswerDraft(e.target.value)}
              rows={current.long ? 10 : 4}
              autoFocus
              placeholder="type your answer, or tap the mic and talk…"
              className="mt-6 w-full resize-y rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed text-ink outline-none focus:border-flame"
            />
            <button
              type="button"
              onClick={() => dictate((t) => setAnswerDraft((prev) => prev + t))}
              className={`mt-3 self-start rounded-full border px-4 py-2 text-sm font-medium transition ${
                listening
                  ? "border-flame bg-flame text-paper"
                  : "border-line text-ink-soft hover:border-flame hover:text-flame"
              }`}
            >
              {listening ? "listening, tap to stop" : "talk instead"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={nextQuestion}
          disabled={
            current.kind === "menu"
              ? filledMenu.filter((r) => r.kind === "item").length === 0
              : current.kind === "hours"
                ? !serializeHours(hoursRows)
                : !answerDraft.trim()
          }
          className="mt-6 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          {reviewIndex !== null
            ? "save and go back →"
            : qIndex < interview.length - 1
              ? "next →"
              : "almost done →"}
        </button>
      </div>
    );
  }

  // ---------- STEP 2.5: photos + build ----------
  if (step === "photos") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <button
          type="button"
          onClick={() => setStep(dump.trim() ? "review" : "describe")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight">
          add your logo and photos<span className="text-flame">?</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Optional, but your own logo and photos are what make it look like
          yours instead of a template.
        </p>

        {/* logo: goes in the header on every page */}
        <p className="mt-8 text-sm font-medium">
          logo <span className="text-faint">(goes in your header)</span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <label className="inline-block w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame">
            {logoBusy ? "uploading…" : logo ? "replace logo" : "+ add logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={logoBusy}
              onChange={(e) => uploadLogo(e.target.files)}
            />
          </label>
          {logo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt="Your logo"
                className="h-12 w-12 rounded-lg border border-line bg-paper object-contain p-1"
              />
              <button
                type="button"
                onClick={clearLogo}
                className="text-xs text-faint transition hover:text-flame"
              >
                remove
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-sm font-medium">
          photos{" "}
          <span className="text-faint">(food, the space, your team)</span>
        </p>
        <label className="mt-2 inline-block w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame">
          {uploading ? "uploading…" : "+ add photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => uploadPhotos(e.target.files)}
          />
        </label>
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="uploaded" className="h-16 w-16 rounded-lg border border-line object-cover" />
            ))}
          </div>
        )}
        {error && <p className="mt-4 text-sm text-flame">{error}</p>}
        <button
          type="button"
          onClick={startBuild}
          disabled={uploading || logoBusy}
          className="mt-8 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          build it →
        </button>
        {(MULTI_PAGE_PURPOSES[siteType ?? ""] ?? []).length > 0 && (
          <p className="mt-3 text-xs text-faint">
            Building your home page and menu page. Takes a little longer than
            one page.
          </p>
        )}
      </div>
    );
  }

  // ---------- OLD describe step (kept off) ----------
  if (false) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto p-8">
        <button
          type="button"
          onClick={() => setStep("vibe")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← change vibe ({vibe})
        </button>
        <h2 className="font-display mt-6 text-3xl font-semibold tracking-tight">
          tell us everything<span className="text-flame">.</span>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The more you share, the better your site. Who is it for? What should
          it say? What sections do you want? What feeling should visitors get?
        </p>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          placeholder="Describe your site in detail…"
          className="mt-6 w-full resize-y rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed outline-none focus:border-flame"
        />
        <p
          className={`mt-2 text-xs ${wordCount >= MIN_WORDS ? "text-ink-soft" : "text-flame"}`}
        >
          {wordCount} / {MIN_WORDS} words minimum
        </p>

        {/* photo upload */}
        <div className="mt-6">
          <p className="text-sm font-medium">
            photos <span className="text-faint">(optional)</span>
          </p>
          <label className="mt-2 inline-block cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame">
            {uploading ? "uploading…" : "+ add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => uploadPhotos(e.target.files)}
            />
          </label>
          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="uploaded"
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-flame">{error}</p>}

        <button
          type="button"
          onClick={startBuild}
          disabled={wordCount < MIN_WORDS || uploading}
          className="mt-8 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          build it →
        </button>
        {wordCount < MIN_WORDS && (
          <p className="mt-2 text-xs text-faint">
            {MIN_WORDS - wordCount} more words to go
          </p>
        )}
      </div>
    );
  }

  // ---------- STEP 3: the builder ----------
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside className="flex w-[36%] max-w-md min-h-0 flex-col border-r border-line p-5">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-mist px-4 py-2.5">
                {m.content.length > 220 ? m.content.slice(0, 220) + "…" : m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line px-4 py-2.5 text-ink-soft">
                {m.content}
              </div>
            ),
          )}
          {busy && (
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line px-4 py-2.5 text-faint">
              building…
            </div>
          )}
          {error && <p className="text-sm text-flame">{error}</p>}
          {buildSeconds !== null && (
            <div className="rounded-2xl border border-flame/40 bg-flame/5 px-4 py-3">
              <p className="font-display text-sm font-semibold">
                built in {Math.floor(buildSeconds / 60)}:{String(buildSeconds % 60).padStart(2, "0")}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `I just built a whole ${kind === "webapp" ? "app" : "website"} in ${Math.floor(buildSeconds / 60)}:${String(buildSeconds % 60).padStart(2, "0")} by describing it. no code. lypo`,
                  );
                }}
                className="mt-1 text-xs font-medium text-flame hover:underline"
              >
                copy the brag →
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STYLES.slice(0, 5).map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => restyle(style.id)}
              disabled={busy}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
            >
              {style.label}
            </button>
          ))}
          <label className="cursor-pointer rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition hover:border-flame hover:text-flame">
            {uploading ? "uploading…" : "+ photo"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading || busy}
              onChange={async (e) => {
                const before = photos.length;
                await uploadPhotos(e.target.files);
                setPhotos((current) => {
                  const added = current.slice(before);
                  if (added.length > 0) {
                    generate(
                      `Add these new photos to the page (as <img> tags with these exact URLs): ${added.join(" , ")}`,
                    );
                  }
                  return current;
                });
              }}
            />
          </label>
        </div>

        {html && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                setPicked(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                editMode
                  ? "border-flame bg-flame text-paper"
                  : "border-line text-ink-soft hover:border-flame hover:text-flame"
              }`}
            >
              {editMode ? "exit edit mode" : "click to edit"}
            </button>
            {picked && (
              <span className="rounded-full bg-mist px-3 py-1 text-xs">
                editing: &lt;{picked.tag}&gt; &ldquo;{picked.text.slice(0, 30)}
                {picked.text.length > 30 ? "…" : ""}&rdquo;
              </span>
            )}
            {editMode && !picked && (
              <span className="text-xs text-faint">
                click anything in the preview →
              </span>
            )}
            <button
              type="button"
              onClick={openHistory}
              disabled={busy}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                showHistory
                  ? "border-flame bg-flame text-paper"
                  : "border-line text-ink-soft hover:border-flame hover:text-flame"
              } disabled:opacity-40`}
            >
              history
            </button>
            <button
              type="button"
              onClick={roast}
              disabled={busy || roasting}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
            >
              {roasting ? "roasting…" : "roast it"}
            </button>
            <button
              type="button"
              onClick={() =>
                generate(
                  "Make the entire site bilingual: English and Spanish. Add a small EN / ES language toggle in the top corner that switches all visible text (vanilla JS, both languages in the document). Translate naturally, not word for word. Keep the design exactly as it is.",
                )
              }
              disabled={busy}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
            >
              en / español
            </button>
          </div>
        )}

        {showHistory && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-line bg-paper p-2">
            {historyBusy && versions.length === 0 ? (
              <p className="px-2 py-1 text-xs text-faint">loading…</p>
            ) : historyError ? (
              <p className="px-2 py-1 text-xs text-flame">{historyError}</p>
            ) : versions.length === 0 ? (
              <p className="px-2 py-1 text-xs text-faint">
                No versions yet. Every change you make from now on is saved
                here.
              </p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-mist"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs">
                      {v.summary ?? "untitled change"}
                    </p>
                    <p className="text-[10px] text-faint">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreVersion(v.id)}
                    disabled={historyBusy || busy}
                    className="shrink-0 text-xs font-medium text-flame transition hover:underline disabled:opacity-40"
                  >
                    restore
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-3 flex items-center gap-3 border-t-2 border-ink pt-3 focus-within:border-flame"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? "building…" : "ask for a change…"}
            disabled={busy}
            aria-label="Describe a change"
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => dictate((t) => setInput((prev) => prev + t))}
            disabled={busy}
            className={`shrink-0 text-xs font-medium transition disabled:opacity-40 ${listening ? "text-flame" : "text-faint hover:text-flame"}`}
            aria-label="Dictate a change"
          >
            voice
          </button>
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 text-sm font-medium text-flame transition hover:translate-x-0.5 disabled:opacity-40"
          >
            →
          </button>
        </form>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-mist/60">
        {/* shrink-0 keeps this bar at its natural height. Without it the
            flex column squeezes it and the controls clip under the header. */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-4 py-2">
          {(["preview", "code", "settings"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                tab === t ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {tab === "preview" &&
              (["desktop", "phone"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    device === d
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            {html && tab !== "settings" && (
              <button
                type="button"
                onClick={downloadHtml}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame"
              >
                download code
              </button>
            )}
          </div>
        </div>
        {/* A flex column, so the page tabs keep their height and the preview
            gets the remaining space instead of overflowing past the bottom. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
          {tab === "preview" ? (
            initialBuilding ? (
              // Nothing is shown until every page is finished.
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="font-display text-lg font-semibold tracking-tight">
                  building your site
                  <span className="text-flame">.</span>
                </p>
                <p className="text-sm text-ink-soft">
                  {buildTotal > 1
                    ? `Writing the ${buildPhase} page (${Math.min(buildDone + 1, buildTotal)} of ${buildTotal}).`
                    : "Writing your home page."}
                </p>
                {buildTotal > 1 && (
                  <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-flame transition-all duration-500"
                      style={{
                        width: `${Math.round((buildDone / buildTotal) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <p className="max-w-xs text-xs text-faint">
                  This takes a minute or two. We show it once the whole site
                  is ready, not half-finished.
                </p>
              </div>
            ) : hasSite ? (
              <>
              {multiPage && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2">
                  {Object.keys(pages).length === 0 && (
                    <span className="text-xs text-faint">no pages yet</span>
                  )}
                  {Object.keys(pages).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => switchPage(name)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        currentPage === name
                          ? "bg-ink text-paper"
                          : "text-ink-soft hover:text-flame"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addPage}
                    disabled={busy}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
                  >
                    + add page
                  </button>
                </div>
              )}
              {!html ? (
                // This page exists but has not been written yet. Showing an
                // empty iframe here is what made new pages look blank.
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <p className="text-sm text-faint">
                    {busy
                      ? `Building the ${currentPage} page…`
                      : `The ${currentPage} page has not been built yet. Ask for it in the chat.`}
                  </p>
                </div>
              ) : device === "phone" ? (
                <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden">
                  <iframe
                    srcDoc={previewHtml}
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    title="Site preview (phone)"
                    // Always light: this is the visitor's view of the site,
                    // not Lypo's chrome, so it must not follow the editor theme.
                    className="h-full w-[390px] shrink-0 rounded-[1.5rem] border-4 border-ink bg-white shadow-lg"
                  />
                </div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-forms allow-same-origin"
                  title="Site preview"
                  // Always light, for the same reason as the phone preview.
                  className="min-h-0 w-full flex-1 rounded-lg border border-line bg-white"
                />
              )}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <p className="text-sm text-faint">
                  {busy ? "Building your first version…" : "Your site appears here."}
                </p>
              </div>
            )
          ) : tab === "code" ? (
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-paper p-4 text-xs leading-relaxed">
              {html || "No code yet. Build something first."}
            </pre>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-lg space-y-3 pb-4">
                <SettingRow
                  title="payments"
                  body={
                    stripeConnected
                      ? "Let this site take donations or payments. Money goes straight to your Stripe account."
                      : "Connect Stripe in your account settings first. Until then this site cannot show payment buttons."
                  }
                  control={
                    <Switch
                      on={paymentsEnabled}
                      disabled={!stripeConnected || settingsBusy}
                      onChange={togglePayments}
                      label="Accept payments on this site"
                    />
                  }
                />

                <SettingRow
                  title="multi-page site"
                  body="Off is one long scrolling page. On lets you add separate pages with a shared nav, like a menu or an about page."
                  control={
                    <Switch
                      on={multiPage}
                      disabled={settingsBusy || busy}
                      onChange={toggleMultiPage}
                      label="Multi-page site"
                    />
                  }
                />

                <SettingRow
                  title="click to edit"
                  body="Click any part of the preview to point at it, then describe the change you want to that piece."
                  control={
                    <Switch
                      on={editMode}
                      disabled={!html}
                      onChange={() => setEditMode((v) => !v)}
                      label="Click to edit"
                    />
                  }
                />

                <SettingRow
                  title="appearance"
                  body="Light or dark. This changes Lypo itself, not the site you are building."
                  control={<ThemeToggle />}
                />

                <div className="rounded-xl border border-line bg-paper p-4">
                  <p className="font-display text-sm font-semibold tracking-tight">
                    your site&apos;s code
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    Download the current page as a single HTML file. It works
                    anywhere, with no Lypo account needed.
                  </p>
                  <button
                    type="button"
                    onClick={downloadHtml}
                    disabled={!html}
                    className="mt-3 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
                  >
                    download {currentPage}.html
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
