export const MODEL = "gpt-5-mini";

/**
 * A stronger model to fall back to when the default keeps failing.
 *
 * Read from the environment rather than hard-coded so a model name that does
 * not exist on the account can never turn a recoverable failure into a
 * guaranteed one. Unset means "retry with the same model", which already
 * clears most transient failures.
 */
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? "";

export type ModelResult =
  | { ok: true; html: string; summary: string; attempts: number; model: string }
  | { ok: false; error: string; attempts: number };

type Message = { role: string; content: unknown };

type CallOutcome =
  | { kind: "ok"; raw: string }
  | { kind: "empty" | "truncated"; detail: string }
  | {
      kind: "http";
      status: number;
      detail: string;
      retryAfterMs?: number;
    };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Whether trying again could plausibly succeed.
 *
 * A rate limit and a server fault will pass; a malformed request, a bad key
 * or an exhausted balance will fail identically every time, so retrying
 * those only burns time the user is sitting through.
 */
function isRetryable(outcome: CallOutcome): boolean {
  if (outcome.kind === "ok") return false;
  if (outcome.kind !== "http") return true; // empty or truncated
  return outcome.status === 429 || outcome.status >= 500;
}

/** Exponential with jitter, so parallel page builds do not retry in lockstep. */
function backoffMs(attempt: number, outcome: CallOutcome): number {
  if (outcome.kind === "http" && outcome.retryAfterMs) {
    return Math.min(outcome.retryAfterMs, 30_000);
  }
  const base = Math.min(1000 * 2 ** attempt, 8000);
  return base + Math.random() * 400;
}

function parse(raw: string) {
  const summaryMatch = raw.match(/<!--\s*summary:\s*([\s\S]*?)-->/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : "Done. Take a look.";
  const html = raw
    .replace(/^```html?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return { summary, html };
}

/**
 * A document cut off at the token ceiling is half written. Saving one would
 * replace a working page with a broken one, so it has to be detectable.
 */
function isComplete(html: string): boolean {
  return /<\/html\s*>|<\/body\s*>/i.test(html);
}

async function callOnce(
  model: string,
  system: string,
  messages: Message[],
  maxTokens: number,
  // A patch reply is a set of blocks, not a document, so the completeness
  // check that guards full generations does not apply to it.
  { requireCompleteHtml = true }: { requireCompleteHtml?: boolean } = {},
): Promise<CallOutcome> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!response.ok) {
    // Retry-After is in seconds when the API sets it, and it is a better
    // number than anything we would invent.
    const header = response.headers.get("retry-after");
    const retryAfterMs = header ? Number(header) * 1000 : undefined;
    return {
      kind: "http",
      status: response.status,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
      detail: (await response.text()).slice(0, 500),
    };
  }

  const data = await response.json();
  const finish: string | undefined = data.choices?.[0]?.finish_reason;
  const raw: string = (data.choices?.[0]?.message?.content ?? "").trim();
  const usage = JSON.stringify(data.usage ?? {});

  // gpt-5-mini spends part of the budget on reasoning before emitting
  // anything, so a budget that runs out shows up as no content at all.
  if (!raw) return { kind: "empty", detail: `finish=${finish} usage=${usage}` };
  if (
    finish === "length" ||
    (requireCompleteHtml && !isComplete(parse(raw).html))
  ) {
    return { kind: "truncated", detail: `finish=${finish} usage=${usage}` };
  }
  return { kind: "ok", raw };
}

/**
 * Instructions that replace the "return the FULL updated document" contract
 * for edits. Re-emitting a 40KB page to change a phone number is slow, costs
 * output tokens in proportion to the page rather than the change, and is the
 * main way a generation runs into the token ceiling.
 */
export const PATCH_CONTRACT = `
YOU ARE EDITING AN EXISTING PAGE. Do NOT return the whole document.

Return ONLY the parts that change, as one or more blocks in exactly this form:

<<<<<<< SEARCH
(text copied character for character from the current page)
=======
(what it should say instead)
>>>>>>> REPLACE

Rules that make this work:
- The SEARCH text must appear in the current page EXACTLY, including tags,
  indentation and spacing. Copy it, do not retype it from memory.
- Include enough surrounding text that the SEARCH appears exactly once. If a
  string like "Contact" appears several times, take the whole element.
- To delete something, leave the REPLACE side empty.
- To add something, SEARCH for the element you want to add next to and put
  both it and the new content in REPLACE.
- Use as many blocks as you need, but only for parts that actually change.
- Change nothing the user did not ask about. Everything you do not touch
  stays exactly as it is, which is the point of editing this way.

Before the first block, put the summary comment on its own line:
<!--summary: one short friendly sentence describing what you changed-->
`.trim();

export type Patch = { search: string; replace: string };

/** Pulls the search/replace blocks out of a model reply. */
export function parsePatches(raw: string): Patch[] {
  const blocks: Patch[] = [];
  const re =
    /<{5,9}\s*SEARCH\s*\n([\s\S]*?)\n?={5,9}\s*\n([\s\S]*?)\n?>{5,9}\s*REPLACE/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    blocks.push({ search: m[1], replace: m[2] });
  }
  return blocks;
}

export type ApplyResult =
  | { ok: true; html: string }
  | { ok: false; reason: string };

/**
 * Applies patches to the current page.
 *
 * Every block must match exactly once. A block that matches nothing means
 * the model invented the text it claimed to be replacing, and one that
 * matches twice means the edit is ambiguous; either way the whole patch is
 * rejected rather than guessing at someone's live site.
 */
export function applyPatches(html: string, patches: Patch[]): ApplyResult {
  if (patches.length === 0) return { ok: false, reason: "no blocks" };

  let out = html;
  for (const [i, p] of patches.entries()) {
    if (!p.search.trim()) return { ok: false, reason: `block ${i + 1} empty` };
    const first = out.indexOf(p.search);
    if (first === -1) return { ok: false, reason: `block ${i + 1} not found` };
    if (out.indexOf(p.search, first + 1) !== -1) {
      return { ok: false, reason: `block ${i + 1} matched more than once` };
    }
    out = out.slice(0, first) + p.replace + out.slice(first + p.search.length);
  }
  return { ok: true, html: out };
}

async function streamOnce(
  model: string,
  system: string,
  messages: Message[],
  maxTokens: number,
  onDelta: (text: string) => void,
): Promise<
  | { kind: "ok"; raw: string }
  | { kind: "empty" | "truncated" | "http"; detail: string }
> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!response.ok || !response.body) {
    return { kind: "http", detail: (await response.text()).slice(0, 500) };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let finish: string | undefined;

  // Server-sent events: "data: {json}" per line, terminated by "data: [DONE]".
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut;
    while ((cut = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        const delta: string = parsed.choices?.[0]?.delta?.content ?? "";
        finish = parsed.choices?.[0]?.finish_reason ?? finish;
        if (delta) {
          raw += delta;
          onDelta(delta);
        }
      } catch {
        // A partial JSON line will arrive complete on the next chunk.
      }
    }
  }

  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty", detail: `finish=${finish}` };
  if (finish === "length" || !isComplete(parse(trimmed).html)) {
    return { kind: "truncated", detail: `finish=${finish}` };
  }
  return { kind: "ok", raw: trimmed };
}

/**
 * Same contract as generatePage, but reports text as it arrives so the
 * builder can show that something is happening instead of a dead minute.
 *
 * Only the first attempt streams. A retry is already the slow path and the
 * user is watching a "retrying" message by then, so there is nothing to gain
 * from streaming output that may be discarded again.
 */
export async function generatePageStreamed({
  system,
  messages,
  maxTokens = 16000,
  onDelta,
}: {
  system: string;
  messages: Message[];
  maxTokens?: number;
  onDelta: (text: string) => void;
}): Promise<ModelResult> {
  try {
    const first = await streamOnce(MODEL, system, messages, maxTokens, onDelta);
    if (first.kind === "ok") {
      const { html, summary } = parse(first.raw);
      return { ok: true, html, summary, attempts: 1, model: MODEL };
    }
    console.error("streamed attempt 1 failed:", first.kind, first.detail);
  } catch (e) {
    console.error("streamed attempt 1 threw:", e);
  }

  // Fall back to the non-streaming path, which handles its own retries.
  const retried = await generatePage({ system, messages, maxTokens });
  if (retried.ok) return { ...retried, attempts: retried.attempts + 1 };
  return { ...retried, attempts: retried.attempts + 1 };
}

/**
 * Edits an existing page by patch, falling back to a full rewrite.
 *
 * The fallback matters: a patch that does not apply cleanly is rejected
 * outright, and the user asked for a change, so the safe answer is to do it
 * the slow reliable way rather than to report a failure they cannot act on.
 */
export async function editPage({
  system,
  currentHtml,
  instruction,
  history,
  pageName,
  maxTokens = 16000,
  onDelta,
}: {
  system: string;
  currentHtml: string;
  instruction: string;
  history: Message[];
  pageName: string;
  maxTokens?: number;
  onDelta?: (text: string) => void;
}): Promise<ModelResult & { patched?: boolean }> {
  const patchMessages: Message[] = [
    ...history,
    {
      role: "user",
      content: `Current page ("${pageName}"):\n${currentHtml}\n\nRequested change: ${instruction}`,
    },
  ];

  try {
    const attempt = await callOnce(
      MODEL,
      `${system}\n\n${PATCH_CONTRACT}`,
      patchMessages,
      // Patches are small, so a page-sized ceiling is unnecessary. Keeping
      // it lower also stops a model that ignores the contract and starts
      // re-emitting the document from burning the full budget.
      Math.min(maxTokens, 6000),
      { requireCompleteHtml: false },
    );

    if (attempt.kind === "ok") {
      const patches = parsePatches(attempt.raw);
      const applied = applyPatches(currentHtml, patches);
      if (applied.ok) {
        const summaryMatch = attempt.raw.match(
          /<!--\s*summary:\s*([\s\S]*?)-->/i,
        );
        return {
          ok: true,
          html: applied.html,
          summary: summaryMatch ? summaryMatch[1].trim() : "Done. Take a look.",
          attempts: 1,
          model: MODEL,
          patched: true,
        };
      }
      // Some replies ignore the contract and return the whole document
      // anyway. That is a usable answer, so take it rather than paying for
      // another call to ask again.
      const whole = parse(attempt.raw);
      if (patches.length === 0 && isComplete(whole.html)) {
        return {
          ok: true,
          html: whole.html,
          summary: whole.summary,
          attempts: 1,
          model: MODEL,
          patched: false,
        };
      }
      console.error("patch rejected, rewriting instead:", applied.reason);
    } else {
      console.error("patch attempt failed:", attempt.kind, attempt.detail);
    }
  } catch (e) {
    console.error("patch attempt threw:", e);
  }

  // Full rewrite, the way edits worked before patches existed.
  const full: Message[] = [
    ...history,
    {
      role: "user",
      content: `Current page ("${pageName}") HTML:\n${currentHtml}\n\nRequested change: ${instruction}`,
    },
  ];
  const rewritten = onDelta
    ? await generatePageStreamed({ system, messages: full, maxTokens, onDelta })
    : await generatePage({ system, messages: full, maxTokens });
  return { ...rewritten, patched: false };
}

/**
 * Generates a page, retrying before giving up.
 *
 * Most failures here are the budget running out rather than the model being
 * incapable, so the retry raises the ceiling first and only then reaches for
 * a stronger model. Every attempt is all-or-nothing: a truncated document is
 * discarded rather than saved over someone's working page.
 */
export async function generatePage({
  system,
  messages,
  maxTokens = 16000,
}: {
  system: string;
  messages: Message[];
  maxTokens?: number;
}): Promise<ModelResult> {
  const plan: { model: string; tokens: number }[] = [
    { model: MODEL, tokens: maxTokens },
    { model: MODEL, tokens: Math.round(maxTokens * 1.5) },
  ];
  if (FALLBACK_MODEL) {
    plan.push({ model: FALLBACK_MODEL, tokens: Math.round(maxTokens * 1.5) });
  }

  let last = "unknown";
  for (let i = 0; i < plan.length; i++) {
    const { model, tokens } = plan[i];
    let result: CallOutcome;
    try {
      result = await callOnce(model, system, messages, tokens);
    } catch (e) {
      // A dropped connection is worth another go, after a pause.
      result = {
        kind: "http",
        status: 503,
        detail: `network: ${e instanceof Error ? e.message : "failed"}`,
      };
    }

    if (result.kind === "ok") {
      const { html, summary } = parse(result.raw);
      return { ok: true, html, summary, attempts: i + 1, model };
    }

    last =
      result.kind === "http"
        ? `http ${result.status}: ${result.detail}`
        : `${result.kind}: ${result.detail}`;
    console.error(
      `generate attempt ${i + 1}/${plan.length} failed (${model}, ${tokens} tok):`,
      last,
    );

    // A malformed request, a bad key or an exhausted balance fails the same
    // way every time. Retrying only makes the user wait longer for it.
    if (!isRetryable(result)) break;

    // Waiting matters most for the case it is most tempting to skip: hitting
    // a rate limit and immediately hammering it again is what turns one 429
    // into three.
    if (i < plan.length - 1) await sleep(backoffMs(i, result));
  }

  console.error(`generate gave up after ${plan.length} attempts, last: ${last}`);
  return {
    ok: false,
    attempts: plan.length,
    error:
      "That didn't come back in one piece, and retrying didn't help. Nothing was changed. Try again, or ask for a smaller change.",
  };
}
