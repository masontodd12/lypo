"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PaymentsToggle({
  projectId,
  initialEnabled,
  stripeConnected,
}: {
  projectId: string;
  initialEnabled: boolean;
  stripeConnected: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (!stripeConnected) {
      alert(
        "Connect your Stripe account in Settings first before enabling payments.",
      );
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const next = !enabled;
    await supabase
      .from("projects")
      .update({ payments_enabled: next })
      .eq("id", projectId);
    setEnabled(next);
    setSaving(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={
        !stripeConnected
          ? "Connect Stripe in Settings to enable payments"
          : enabled
          ? "Payments on. Click to disable."
          : "Payments off. Click to enable."
      }
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
        enabled
          ? "border-flame bg-flame/10 text-flame"
          : "border-line text-faint hover:border-ink hover:text-ink-soft"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${enabled ? "bg-flame" : "bg-line"}`}
      />
      {saving ? "saving..." : enabled ? "payments on" : "payments off"}
    </button>
  );
}
