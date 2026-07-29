"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

const MIN_WORDS = 200;

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



const INTERVIEW = [
  { q: "what's it called?", hint: "The name of your site, business, group, or idea." },
  { q: "who is it for?", hint: "Who should visit this — customers, neighbors, friends, donors?" },
  { q: "what should it say?", hint: "The main message, story, or info visitors need to know." },
  { q: "what should visitors do?", hint: "Sign up? Donate? Contact you? Browse your work?" },
  { q: "anything else?", hint: "Colors you love, sections you want, vibes, details — anything." },
];

// Purpose modes: each maps to a server-side block in /api/generate that
// pre-loads the sections this kind of site actually needs.
const SITE_TYPES = [
  { id: "fundraiser", label: "fundraiser", blurb: "raise money for a person or cause", hint: "a fundraiser page" },
  { id: "memorial", label: "memorial", blurb: "honor someone, share service details", hint: "a memorial page" },
  { id: "church", label: "church / worship", blurb: "service times, visitors, giving", hint: "a church website" },
  { id: "barbershop", label: "barbershop / salon", blurb: "services, prices, booking, your work", hint: "a barbershop or salon website" },
  { id: "foodtruck", label: "food truck / restaurant", blurb: "menu, location, hours", hint: "a food business website" },
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
}: {
  initialPages: Record<string, string> | null;
  initialMultiPage: boolean;
  projectId: string;
  initialIdea: string | null;
  initialHtml: string | null;
  initialMessages: Message[];
  initialName: string;
  initialKind: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [html, setHtml] = useState(initialHtml ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [step, setStep] = useState<
    "setup" | "type" | "vibe" | "describe" | "photos" | "build"
  >(initialHtml ? "build" : "setup");
  const [siteType, setSiteType] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(
    initialName === "untitled" ? "" : initialName,
  );
  const [kind, setKind] = useState<string>(initialKind ?? "website");
  const [vibe, setVibe] = useState<string | null>(null);
  const [description, setDescription] = useState(initialIdea ?? "");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const buildStart = useRef<number | null>(null);
  const [buildSeconds, setBuildSeconds] = useState<number | null>(null);
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
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      setVersions([]);
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
        setHtml(data.html);
        setPages((prev) => ({ ...prev, [data.page ?? currentPage]: data.html }));
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
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ multi_page: next })
      .eq("id", projectId);
  }

  function switchPage(name: string) {
    setCurrentPage(name);
    setHtml(pages[name] ?? "");
    setPicked(null);
  }

  function addPage() {
    const raw = prompt(
      "Name the new page (like about, menu, contact):",
    );
    if (!raw) return;
    const name = raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").slice(0, 24);
    if (!name || pages[name]) return;
    setPages((prev) => ({ ...prev, [name]: "" }));
    setCurrentPage(name);
    setHtml("");
    generate(
      `Create the "${name}" page for this site. Match the existing style exactly and include the shared nav.`,
      undefined,
      name,
    );
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
      alert("Voice input needs Chrome or Edge — type it instead for now.");
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

  async function generate(message: string, imageUrls?: string[], pageOverride?: string) {
    const targetPage = pageOverride ?? currentPage;
    setBusy(true);
    setError("");
    if (!html) buildStart.current = Date.now();
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
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        setMessages((prev) => prev.slice(0, -1));
      } else {
        if (!html && buildStart.current) {
          setBuildSeconds(Math.round((Date.now() - buildStart.current) / 1000));
          buildStart.current = null;
        }
        setHtml(data.html);
        setPages((prev) => ({ ...prev, [targetPage]: data.html }));
        setTab("preview");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.summary },
        ]);
      }
    } catch {
      setError("Couldn't reach the server — check your connection.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  function startBuild() {
    const style = STYLES.find((s) => s.id === vibe);
    if (!style) return;
    setStep("build");
    const typeHint = SITE_TYPES.find((t) => t.id === siteType)?.hint;
    const photoNote =
      photos.length > 0
        ? ` Use these uploaded photos in the design (as <img> tags with these exact URLs): ${photos.join(" , ")}`
        : "";
    const kindNote =
      kind === "webapp"
        ? "This is a WEB APP: an interactive single-page tool with working JavaScript functionality, not a brochure site."
        : "This is a WEBSITE: a single-page site with NO navigation tabs or menu links at the top — one continuous scrolling page.";
    generate(
      `${kindNote} ${typeHint ? `Build ${typeHint}. ` : ""}${description.trim()} ${style.prompt}${photoNote}`,
    );
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
          name your project<span className="text-flame">.</span>
        </h2>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Second Harvest Neighbors"
          aria-label="Project name"
          className="mt-6 w-full border-b-2 border-ink bg-transparent py-3 text-lg outline-none placeholder:text-faint focus:border-flame"
        />

        <p className="font-display mt-12 text-xl font-semibold tracking-tight">
          what kind of thing<span className="text-flame">?</span>
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
              A beautiful one-page site — for a cause, business, portfolio, or
              event.
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
              An interactive tool — a calculator, tracker, quiz, or something
              that does things.
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
          what are we making<span className="text-flame">?</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Here&apos;s what people build with lypo. Pick the closest fit.
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
          Not seeing yours? Pick the closest — you can make it anything in the
          next step.
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
          pick a vibe<span className="text-flame">.</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          This sets the whole look. You can change it anytime later.
        </p>
        <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setVibe(style.id);
                setStep("describe");
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
  function nextQuestion() {
    const updated = [...answers];
    updated[qIndex] = answerDraft.trim();
    setAnswers(updated);
    setAnswerDraft(updated[qIndex + 1] ?? "");
    if (qIndex < INTERVIEW.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      const combined = INTERVIEW.map(
        (item, i) => `${item.q} ${updated[i]}`,
      ).join(" ");
      setDescription(`${initialIdea ? initialIdea + ". " : ""}${combined}`);
      setStep("photos");
    }
  }

  if (step === "describe") {
    const current = INTERVIEW[qIndex];
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-8">
        <button
          type="button"
          onClick={() =>
            qIndex === 0 ? setStep("vibe") : (setQIndex(qIndex - 1), setAnswerDraft(answers[qIndex - 1]))
          }
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <p className="mt-8 text-xs tracking-widest text-faint">
          {qIndex + 1} / {INTERVIEW.length}
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">
          {current.q}
          <span className="text-flame">.</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{current.hint}</p>
        <textarea
          value={answerDraft}
          onChange={(e) => setAnswerDraft(e.target.value)}
          rows={4}
          autoFocus
          placeholder="type your answer — or tap the mic and talk…"
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
          {listening ? "listening — tap to stop" : "talk instead"}
        </button>
        <button
          type="button"
          onClick={nextQuestion}
          disabled={!answerDraft.trim()}
          className="mt-6 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          {qIndex < INTERVIEW.length - 1 ? "next →" : "almost done →"}
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
          onClick={() => setStep("describe")}
          className="self-start text-sm text-faint transition hover:text-flame"
        >
          ← back
        </button>
        <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight">
          add photos<span className="text-flame">?</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Optional — your own photos make it feel real. Skip if you want.
        </p>
        <label className="mt-6 inline-block w-fit cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-flame hover:text-flame">
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
          disabled={uploading}
          className="mt-8 self-start rounded-full bg-flame px-8 py-3 font-display font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
        >
          build it →
        </button>
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
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-[36%] max-w-md flex-col border-r border-line p-5">
        <div className="flex-1 space-y-3 overflow-y-auto text-sm">
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
              onClick={toggleMultiPage}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                multiPage
                  ? "border-flame bg-flame text-paper"
                  : "border-line text-ink-soft hover:border-flame hover:text-flame"
              }`}
            >
              {multiPage ? "multi-page on" : "multi-page off"}
            </button>
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

      <section className="flex flex-1 flex-col bg-mist/60">
        <div className="flex items-center gap-1 border-b border-line px-4 py-2">
          {(["preview", "code"] as const).map((t) => (
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
            {html && (
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
        <div className="flex-1 p-4">
          {tab === "preview" ? (
            html || multiPage ? (
              <>
              {multiPage && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-mist/40 px-3 py-2">
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
              {device === "phone" ? (
                <div className="flex h-full items-start justify-center overflow-hidden py-2">
                  <iframe
                    srcDoc={previewHtml}
                    sandbox="allow-scripts allow-forms allow-same-origin"
                    title="Site preview (phone)"
                    className="h-full w-[390px] shrink-0 rounded-[1.5rem] border-4 border-ink bg-paper shadow-lg"
                  />
                </div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts allow-forms allow-same-origin"
                  title="Site preview"
                  className="h-full w-full rounded-lg border border-line bg-paper"
                />
              )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-faint">
                  {busy ? "Building your first version…" : "Your site appears here."}
                </p>
              </div>
            )
          ) : (
            <pre className="h-full overflow-auto rounded-lg border border-line bg-paper p-4 text-xs leading-relaxed">
              {html || "No code yet — build something first."}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
