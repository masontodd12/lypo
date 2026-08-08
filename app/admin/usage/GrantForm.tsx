"use client";

import { useState, useTransition } from "react";
import { setGrant } from "../actions";

export function GrantForm({
  userId,
  email,
  current,
  note,
}: {
  userId: string;
  email: string;
  current: number;
  note: string;
}) {
  const [extra, setExtra] = useState(String(current));
  const [reason, setReason] = useState(note);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        max={500}
        value={extra}
        onChange={(e) => {
          setExtra(e.target.value);
          setSaved(false);
        }}
        aria-label={`Extra sites for ${email}`}
        className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-flame"
      />
      <input
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setSaved(false);
        }}
        placeholder="why (optional)"
        aria-label={`Reason for ${email}`}
        className="w-44 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-flame"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void setGrant(userId, Number(extra) || 0, reason).then(() =>
              setSaved(true),
            );
          })
        }
        className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-flame hover:text-flame disabled:opacity-40"
      >
        {pending ? "saving" : saved ? "saved" : "save"}
      </button>
    </div>
  );
}
