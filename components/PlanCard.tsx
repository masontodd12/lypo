"use client";

import { useState } from "react";

/**
 * Subscribe, or manage an existing subscription.
 *
 * Both actions hand off to Stripe rather than being built here. Cancelling in
 * particular has to be easy to find: burying it is the thing that turns a
 * refund request into a chargeback.
 */
export function PlanCard({
  subscribed,
  status,
  renewsOn,
}: {
  subscribed: boolean;
  status: string | null;
  renewsOn: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(path: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-14">
      <h2 className="font-display text-lg font-semibold">plan</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {subscribed
          ? "Your sites are published and live."
          : "Building and previewing are free. A plan is what publishes a site."}
      </p>

      {subscribed ? (
        <div className="mt-4">
          <p className="text-sm">
            <span className="font-medium">Active</span>
            {status && status !== "active" && (
              <span className="text-ink-soft"> · {status}</span>
            )}
            {renewsOn && (
              <span className="text-ink-soft"> · renews {renewsOn}</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => go("/api/stripe/portal")}
            disabled={busy}
            className="mt-3 text-sm font-medium text-flame transition hover:underline disabled:opacity-40"
          >
            {busy ? "opening…" : "manage billing, change card, or cancel"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => go("/api/stripe/checkout")}
          disabled={busy}
          className="mt-4 rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "opening…" : "see plans"}
        </button>
      )}

      {error && <p className="mt-2 text-sm text-flame">{error}</p>}
    </div>
  );
}
