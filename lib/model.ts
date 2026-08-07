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
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!response.ok) {
    return { kind: "http", detail: (await response.text()).slice(0, 500) };
  }

  const data = await response.json();
  const finish: string | undefined = data.choices?.[0]?.finish_reason;
  const raw: string = (data.choices?.[0]?.message?.content ?? "").trim();
  const usage = JSON.stringify(data.usage ?? {});

  // gpt-5-mini spends part of the budget on reasoning before emitting
  // anything, so a budget that runs out shows up as no content at all.
  if (!raw) return { kind: "empty", detail: `finish=${finish} usage=${usage}` };
  if (finish === "length" || !isComplete(parse(raw).html)) {
    return { kind: "truncated", detail: `finish=${finish} usage=${usage}` };
  }
  return { kind: "ok", raw };
}

/**
 * Generates a page, retrying before giving up.
 *
 * Most failures here are the budget running out rather than the model being
 * incapable, so the retry raises the ceiling first and only then reaches for
 * a stronger model. Every attempt is all-or-nothing: a truncated document is
 * discarded rather than saved over someone's working page.
 */
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
    let result;
    try {
      result = await callOnce(model, system, messages, tokens);
    } catch (e) {
      last = `network: ${e instanceof Error ? e.message : "failed"}`;
      continue;
    }

    if (result.kind === "ok") {
      const { html, summary } = parse(result.raw);
      return { ok: true, html, summary, attempts: i + 1, model };
    }

    last = `${result.kind}: ${result.detail}`;
    console.error(
      `generate attempt ${i + 1}/${plan.length} failed (${model}, ${tokens} tok):`,
      result.detail,
    );

    // A bad request will fail identically every time, so stop rather than
    // burning the account's quota on it.
    if (result.kind === "http" && /invalid|not found|model/i.test(result.detail)) {
      break;
    }
  }

  return {
    ok: false,
    attempts: plan.length,
    error:
      "That didn't come back in one piece, and retrying didn't help. Nothing was changed. Try again, or ask for a smaller change.",
  };
}
