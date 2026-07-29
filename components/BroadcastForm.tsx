"use client";

import { useState } from "react";

export function BroadcastForm({
  projectId,
  emailCount,
}: {
  projectId: string;
  emailCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function send() {
    if (!subject.trim() || !body.trim() || busy) return;
    if (
      !confirm(
        `Send this to ${emailCount} supporter${emailCount === 1 ? "" : "s"}? This can't be unsent.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(`Sent to ${data.sent} of ${data.total} supporters.`);
        setSubject("");
        setBody("");
        setOpen(false);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (emailCount === 0) return null;

  return (
    <div className="mt-8">
      {!open ? (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-flame px-5 py-2 font-display text-sm font-semibold text-paper transition hover:bg-flame-bright"
          >
            message my supporters ({emailCount})
          </button>
          {result && <p className="text-sm text-ink-soft">{result}</p>}
        </div>
      ) : (
        <div className="max-w-xl rounded-xl border border-line bg-paper p-5">
          <p className="font-display font-semibold">
            message your supporters<span className="text-flame">.</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Goes to the {emailCount} email address
            {emailCount === 1 ? "" : "es"} collected from your responses.
            Replies come to you. Limit 3 per day.
          </p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="subject"
            aria-label="Email subject"
            maxLength={150}
            className="mt-4 w-full border-b-2 border-ink bg-transparent py-2 text-sm outline-none placeholder:text-faint focus:border-flame"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="your update…"
            aria-label="Email message"
            rows={5}
            maxLength={5000}
            className="mt-3 w-full resize-y rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed outline-none focus:border-flame"
          />
          {error && <p className="mt-2 text-sm text-flame">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={busy || !subject.trim() || !body.trim()}
              className="rounded-full bg-flame px-5 py-2 font-display text-sm font-semibold text-paper transition hover:bg-flame-bright disabled:opacity-40"
            >
              {busy ? "sending…" : "send it"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="text-sm text-faint transition hover:text-flame"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
