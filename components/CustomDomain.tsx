"use client";

import { useEffect, useRef, useState } from "react";
import { checkCustomDomain } from "@/lib/links";

type Verification = { type: string; domain: string; value: string };

type Offer = { domain: string; available: boolean | null; price: number | null };

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

/**
 * One domain, and what someone can do about it.
 *
 * The buy links go to registrars rather than anywhere of ours. Lypo does not
 * sell domains and handles no money; sending people to a shop that does is
 * the whole feature. Two are offered because prices differ and nobody should
 * feel funnelled.
 */
function Result({
  offer,
  onPick,
}: {
  offer: Offer;
  onPick: (domain: string) => void;
}) {
  const shops: [string, string][] = [
    ["Porkbun", `https://porkbun.com/checkout/search?q=${encodeURIComponent(offer.domain)}`],
    [
      "Namecheap",
      `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(offer.domain)}`,
    ],
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">{offer.domain}</p>
        <p className="mt-0.5 text-xs text-faint">
          {offer.available === null ? (
            "we could not check this one"
          ) : offer.available ? (
            <>
              free to register
              {offer.price !== null && (
                <>
                  {" "}
                  · about ${offer.price}/year
                  {/* Vercel quotes higher than most registrars, so this is a
                      guide rather than the price they will pay. */}
                  <span className="text-faint"> (shops vary)</span>
                </>
              )}
            </>
          ) : (
            "already taken"
          )}
        </p>
      </div>
      {/* Shown unless we know it is taken. An unchecked name still needs
          somewhere to go: the registrar will say whether it is free, and
          that is the trip they were making anyway. */}
      {offer.available !== false && (
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {shops.map(([name, url]) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onPick(offer.domain)}
              className="font-medium text-flame transition hover:underline"
            >
              {name} ↗
            </a>
          ))}
        </div>
      )}
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

  // The "I do not have one yet" path. Kept separate from `input` above, so
  // searching for a name to buy never overwrites a domain someone is part
  // way through typing.
  const [mode, setMode] = useState<"have" | "find">("have");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [alternatives, setAlternatives] = useState<Offer[]>([]);
  const [searchError, setSearchError] = useState("");
  /** A domain they left to go and buy, remembered across visits. */
  const [desired, setDesired] = useState<string | null>(null);
  /** Set once a check shows the remembered name is no longer available. */
  const [looksBought, setLooksBought] = useState(false);
  /** The name already asked about, so the poll does not ask again. */
  const checkedRef = useRef<string | null>(null);

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
        if (!data.domain) {
          const wanted: string | null = data.desiredDomain ?? null;
          setDesired(wanted);
          // Once per name, not once per poll: this is a Vercel lookup, and
          // the answer cannot change often enough to be worth asking every
          // twenty seconds for as long as the panel is open.
          if (wanted && checkedRef.current !== wanted) {
            checkedRef.current = wanted;
            // A name that has stopped being available is the closest honest
            // signal that their purchase went through. It is a hint, not
            // proof: someone else could have taken it. Either way the next
            // step is the same, and connecting is what really decides.
            try {
              const look = await fetch(
                `/api/domain/search?q=${encodeURIComponent(wanted)}`,
              );
              const found = await look.json();
              if (!cancelled && look.ok && found.offer?.available === false) {
                setLooksBought(true);
              }
            } catch {
              // Silent: this only ever adds a prompt, never removes one.
            }
          }
        }
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

  async function connect(override?: string) {
    const check = checkCustomDomain(override ?? input);
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
        // Connected, so the "you were getting X" prompt has done its job.
        setDesired(null);
        setLooksBought(false);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function search(term?: string) {
    const q = (term ?? query).trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setOffer(null);
    setAlternatives([]);
    try {
      const res = await fetch(`/api/domain/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error ?? "Couldn't check that one.");
        return;
      }
      setOffer(data.offer);
      setAlternatives(data.alternatives ?? []);
      // Not an error: the name still gets shown with buy links. It only
      // explains why there is no yes-or-no beside it.
      setSearchError(data.unchecked ? (data.reason ?? "") : "");
    } catch {
      setSearchError("Couldn't reach the server.");
    } finally {
      setSearching(false);
    }
  }

  /**
   * Remembers a name they are going off to buy.
   *
   * Deliberately fire-and-forget: they are already on their way to a
   * registrar in another tab, and a failed write here should not interrupt
   * that. Worst case they type the domain in by hand when they come back.
   */
  function remember(domain: string | null) {
    setDesired(domain);
    void fetch("/api/domain/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, domain }),
    }).catch(() => {});
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
              {/* The return trip. Shown before anything else, because
                  someone who left to buy a name came back to do exactly
                  this and should not have to find it again. */}
              {desired && (
                <div className="mt-3 rounded-lg border border-flame/40 bg-flame/5 p-3">
                  <p className="text-xs leading-relaxed">
                    You were getting{" "}
                    <span className="font-mono font-medium">{desired}</span>.
                    {looksBought
                      ? " It is registered now, so if that was you, connect it."
                      : " Bought it? Connect it here."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInput(desired);
                        setMode("have");
                        void connect(desired);
                      }}
                      disabled={busy}
                      className="rounded-full bg-flame px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-flame-bright disabled:opacity-40"
                    >
                      {busy ? "connecting…" : `connect ${desired}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => remember(null)}
                      className="text-xs text-faint transition hover:text-flame"
                    >
                      never mind
                    </button>
                  </div>
                  {error && <p className="mt-2 text-xs text-flame">{error}</p>}
                </div>
              )}

              <div className="mt-3 flex gap-3 border-b border-line text-xs">
                {(
                  [
                    ["have", "I have a domain"],
                    ["find", "I need one"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={`-mb-px border-b-2 pb-2 font-medium transition ${
                      mode === id
                        ? "border-flame text-flame"
                        : "border-transparent text-ink-soft hover:text-flame"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "have" ? (
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
                      onClick={() => connect()}
                      disabled={busy || !input.trim()}
                      className="shrink-0 rounded-full bg-flame px-4 py-2 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-40"
                    >
                      {busy ? "connecting…" : "connect"}
                    </button>
                  </div>
                  {error && !desired && (
                    <p className="mt-2 text-xs text-flame">{error}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                    Type the name you want. We will tell you if it is free.
                    You buy it from a registrar, we never handle the money,
                    and it is usually about ten to fifteen dollars a year.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSearchError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && search()}
                      placeholder="joesbarbershop"
                      aria-label="Domain name to look for"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-flame"
                    />
                    <button
                      type="button"
                      onClick={() => search()}
                      disabled={searching || !query.trim()}
                      className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:border-flame hover:text-flame disabled:opacity-40"
                    >
                      {searching ? "checking…" : "check"}
                    </button>
                  </div>
                  {searchError && (
                    <p className="mt-2 text-xs text-flame">{searchError}</p>
                  )}

                  {offer && (
                    <div className="mt-3 space-y-2">
                      <Result offer={offer} onPick={remember} />
                      {offer.available === false && alternatives.length > 0 && (
                        <>
                          <p className="pt-1 text-xs text-ink-soft">
                            These are free:
                          </p>
                          {alternatives.map((a) => (
                            <Result
                              key={a.domain}
                              offer={a}
                              onPick={remember}
                            />
                          ))}
                        </>
                      )}
                      {offer.available === false && alternatives.length === 0 && (
                        <p className="text-xs text-ink-soft">
                          Nothing close was free. Try adding your town, or the
                          kind of work you do.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
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
