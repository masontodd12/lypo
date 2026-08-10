"use client";

import { useEffect, useState } from "react";
import { checkCustomDomain } from "@/lib/links";

type Verification = { type: string; domain: string; value: string };

type State = {
  domain: string | null;
  verified: boolean;
  misconfigured: boolean;
  verification: Verification[];
  isApex: boolean;
  records: { apexARecord: string; cnameTarget: string; configured: boolean };
};

function Record({
  type,
  name,
  value,
}: {
  type: string;
  name: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2 text-xs first:border-t-0">
      <div className="min-w-0">
        <span className="lypo-label text-faint">{type}</span>
        <p className="mt-0.5 truncate font-mono">{name}</p>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate font-mono">{value}</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 font-medium text-flame transition hover:underline"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
    </div>
  );
}

export function CustomDomain({
  projectId,
  published,
}: {
  projectId: string;
  published: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  /**
   * Loads the current state, then keeps checking while DNS settles.
   *
   * One effect rather than a load plus a separate poll: the work is
   * identical, the cancelled flag stops a reply landing after unmount, and
   * the interval clears itself once there is nothing left to wait for.
   */
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch(`/api/domain?projectId=${projectId}`);
        if (res.status === 503) return; // not switched on
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setState(data.domain ? data : null);
        if (data.domain && data.verified && !data.misconfigured) {
          clearInterval(timer);
        }
      } catch {
        // Keep the last known state rather than flashing an error at someone
        // who is only waiting for DNS to propagate.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void refresh();
    const timer = setInterval(refresh, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId]);

  async function connect() {
    const check = checkCustomDomain(input);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, domain: check.domain }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Couldn't connect that domain.");
      else {
        setState(data);
        setInput("");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true);
    try {
      const res = await fetch("/api/domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, recheck: true }),
      });
      const data = await res.json();
      if (res.ok) setState(data);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !confirm(
        `Disconnect ${state?.domain}? Your site stays live on its lypo.dev address.`,
      )
    )
      return;
    setBusy(true);
    try {
      await fetch("/api/domain", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      setState(null);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  const live = state?.verified && !state.misconfigured;

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="font-display text-sm font-semibold tracking-tight">
        your own domain
      </p>

      {!state ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Use a domain you already own instead of a lypo.dev address. You
            keep the domain; this only points it here.
          </p>
          {!published ? (
            <p className="mt-3 text-xs text-faint">
              Publish the site first, then you can connect a domain to it.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && connect()}
                  placeholder="yourbusiness.com"
                  aria-label="Your domain"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-flame"
                />
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy || !input.trim()}
                  className="shrink-0 rounded-full bg-flame px-4 py-2 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-40"
                >
                  {busy ? "connecting…" : "connect"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-flame">{error}</p>}
            </>
          )}
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{state.domain}</span>
            <span
              className={`lypo-label ${live ? "text-flame" : "text-faint"}`}
            >
              {live ? "live" : "waiting for dns"}
            </span>
          </div>

          {!live && (
            <>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Add {state.isApex ? "this record" : "this record"} wherever you
                bought the domain, then leave it. It usually works within an
                hour, but can take up to a day. We keep checking.
              </p>

              {!state.records.configured && (
                <p className="mt-2 text-xs text-flame">
                  Heads up: VERCEL_DNS_A and VERCEL_DNS_CNAME are not set, so
                  the values below are defaults and may not match this project.
                </p>
              )}

              <div className="mt-3 rounded-lg border border-line px-3">
                {state.isApex ? (
                  <Record type="A" name="@" value={state.records.apexARecord} />
                ) : (
                  <Record
                    type="CNAME"
                    name={state.domain!.split(".")[0]}
                    value={state.records.cnameTarget}
                  />
                )}
                {state.verification.map((v) => (
                  <Record
                    key={v.value}
                    type={v.type}
                    name={v.domain}
                    value={v.value}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={recheck}
                disabled={busy}
                className="mt-3 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
              >
                {busy ? "checking…" : "check now"}
              </button>
            </>
          )}

          {live && (
            <p className="mt-1 text-xs text-ink-soft">
              Visitors reach your site at{" "}
              <a
                href={`https://${state.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-flame hover:underline"
              >
                {state.domain}
              </a>
              . The lypo.dev address keeps working too.
            </p>
          )}

          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="mt-3 ml-0 block text-xs text-faint transition hover:text-flame disabled:opacity-40"
          >
            disconnect
          </button>
        </>
      )}
    </div>
  );
}
