"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const value = newEmail.trim().toLowerCase();
    if (!value || value === currentEmail) return;
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email: value },
      { emailRedirectTo: `${window.location.origin}/settings` },
    );

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
      setMessage(
        `Confirmation links sent. Check both ${currentEmail} and ${value}. Click the link in each to complete the change.`,
      );
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm">
        current: <span className="font-medium">{currentEmail}</span>
      </p>

      {status === "sent" ? (
        <div className="mt-4 border-l-2 border-flame pl-4">
          <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
        </div>
      ) : (
        <form onSubmit={changeEmail} className="mt-4 max-w-sm">
          <div className="flex items-center gap-3 border-b-2 border-ink py-2 focus-within:border-flame">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new email address"
              aria-label="New email address"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button
              type="submit"
              disabled={status === "sending" || !newEmail.trim()}
              className="shrink-0 text-sm font-medium text-flame transition hover:translate-x-0.5 disabled:opacity-40"
            >
              {status === "sending" ? "sending…" : "change"}
            </button>
          </div>
          {status === "error" && (
            <p className="mt-2 text-sm text-flame">{message}</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-faint">
            For security you&apos;ll confirm from both your old and new email
            before the change takes effect.
          </p>
        </form>
      )}
    </div>
  );
}