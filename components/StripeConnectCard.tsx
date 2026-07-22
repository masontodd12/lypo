"use client";

import { useState } from "react";

export function StripeConnectCard({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Could not start payment setup.");
        setBusy(false);
      }
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">payments</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Connected. Donate and payment buttons on your published sites send
          money straight to your bank account.
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-flame transition hover:underline"
          >
            view your Stripe dashboard
          </a>
          <button
            onClick={connect}
            disabled={busy}
            className="text-faint transition hover:text-flame disabled:opacity-40"
          >
            {busy ? "opening..." : "update details"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="font-display text-lg font-semibold">payments</h2>
      <div className="mt-3 max-w-md">
        <p className="text-sm leading-relaxed text-ink-soft">
          Want your sites to accept donations or payments? Connect an account
          with Stripe, the same payment company big businesses use. You will
          enter your details and bank info directly with Stripe; Lypo never
          sees them. Money from your sites goes straight to you.
        </p>
        <button
          onClick={connect}
          disabled={busy}
          className="mt-4 rounded-full bg-flame px-6 py-2.5 text-sm font-medium text-paper transition hover:bg-flame-bright disabled:opacity-50"
        >
          {busy ? "opening..." : "connect payments"}
        </button>
        {error && <p className="mt-2 text-sm text-flame">{error}</p>}
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Takes about 5 minutes. Until this is set up, sites cannot show donate
          or payment buttons.
        </p>
      </div>
    </div>
  );
}
