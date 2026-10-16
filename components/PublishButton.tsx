"use client";

import { useState } from "react";

export function PublishButton({
  projectId,
  initialSlug,
  initialStatus,
  appHost,
  pathRouting,
}: {
  projectId: string;
  initialSlug: string | null;
  initialStatus: string;
  /** Bare app host, e.g. "lypo.dev". */
  appHost: string;
  /** True in local dev and previews, where wildcard DNS doesn't exist. */
  pathRouting: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  const [desired, setDesired] = useState(initialSlug ?? "");
  const [story, setStory] = useState("");
  const [error, setError] = useState("");
  /** Publishing was refused because there is no subscription. */
  const [needsPlan, setNeedsPlan] = useState(false);

  // Canonical published address: my-site.lypo.dev in production,
  // /s/my-site locally and on preview deploys.
  const liveUrl = slug
    ? pathRouting
      ? `/s/${slug}`
      : `https://${slug}.${appHost}`
    : null;
  const liveLabel = slug
    ? pathRouting
      ? `/s/${slug}`
      : `${slug}.${appHost}`
    : null;

  /** Sends them to Stripe Checkout, then back here to publish. */
  async function subscribe(interval: "month" | "year") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Couldn't start checkout.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(withSlug?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          desiredSlug: withSlug ?? undefined,
          story: story || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlug(data.slug);
        setStatus("published");
        setPicking(false);
      } else if (data.needsSubscription) {
        // Not an error they can retry their way out of, so it gets its own
        // state and a way forward rather than red text saying no.
        setNeedsPlan(true);
        setPicking(false);
      } else {
        setError(data.error ?? "Publish failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  function onPublishClick() {
    if (!slug) {
      setPicking(true); // first publish: pick your link
    } else {
      publish(); // republish under existing link
    }
  }

  function copyLink() {
    if (!liveUrl) return;
    navigator.clipboard.writeText(
      liveUrl.startsWith("http")
        ? liveUrl
        : `${window.location.origin}${liveUrl}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative flex items-center gap-3">
      {status === "published" && liveUrl && (
        <>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={liveLabel ?? undefined}
            className="text-sm font-medium text-ink-soft transition hover:text-flame"
          >
            view live ↗
          </a>
          <button
            onClick={copyLink}
            className="text-sm font-medium text-ink-soft transition hover:text-flame"
          >
            {copied ? "copied!" : "copy link"}
          </button>
          <a
            href={`/poster/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ink-soft transition hover:text-flame"
          >
            poster
          </a>
        </>
      )}
      <button
        onClick={onPublishClick}
        disabled={busy}
        className="rounded-full bg-flame px-5 py-2 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-50"
      >
        {busy
          ? "publishing…"
          : status === "published"
            ? "republish"
            : "publish"}
      </button>

      {needsPlan && (
        <div className="absolute top-12 right-0 z-20 w-80 rounded-xl border border-flame/40 bg-paper p-4 shadow-lg">
          <p className="text-xs leading-relaxed">
            Publishing needs a Lypo plan. Everything you have built is saved,
            and building and previewing stay free.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => subscribe("month")}
              disabled={busy}
              className="rounded-full bg-flame px-3 py-1.5 text-xs font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "opening…" : "$30/mo"}
            </button>
            <button
              type="button"
              onClick={() => subscribe("year")}
              disabled={busy}
              className="rounded-full border border-flame px-3 py-1.5 text-xs font-medium text-flame transition hover:bg-flame/5 disabled:opacity-40"
            >
              $300/yr
            </button>
            <button
              type="button"
              onClick={() => setNeedsPlan(false)}
              className="text-xs text-faint transition hover:text-flame"
            >
              not now
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-flame">{error}</p>}
        </div>
      )}

      {picking && (
        <div className="absolute top-12 right-0 z-20 w-80 rounded-xl border border-line bg-paper p-5 shadow-lg">
          <p className="font-display font-semibold">
            pick your link<span className="text-flame">.</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            This becomes your site&apos;s address. Lowercase letters, numbers,
            and hyphens.
          </p>
          <div className="mt-4 flex items-center gap-0.5 border-b-2 border-ink py-2 text-sm focus-within:border-flame">
            {pathRouting && <span className="shrink-0 text-faint">/s/</span>}
            <input
              value={desired}
              onChange={(e) =>
                setDesired(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                )
              }
              placeholder="second-harvest"
              aria-label="Custom link name"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-faint"
              autoFocus
            />
            {!pathRouting && (
              <span className="shrink-0 text-faint">.{appHost}</span>
            )}
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            what is this for?{" "}
            <span className="text-faint">(one line, optional)</span>
          </p>
          <input
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Feeding 40 families every Saturday"
            aria-label="What is this site for"
            className="mt-1 w-full border-b-2 border-ink bg-transparent py-2 text-sm outline-none placeholder:text-faint focus:border-flame"
          />
          {error && <p className="mt-2 text-xs text-flame">{error}</p>}
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              onClick={() => setPicking(false)}
              className="text-sm text-faint transition hover:text-ink"
            >
              cancel
            </button>
            <button
              onClick={() => publish(desired)}
              disabled={busy || desired.length < 3}
              className="rounded-full bg-flame px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-40"
            >
              {busy ? "…" : "go live →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
