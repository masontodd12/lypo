"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemixButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remix() {
    setBusy(true);
    const res = await fetch("/api/remix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) router.push(`/builder/${data.id}`);
    else if (res.status === 401) router.push("/login?next=/gallery");
    else alert(data.error ?? "Remix failed");
  }

  return (
    <button
      onClick={remix}
      disabled={busy}
      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:border-flame hover:text-flame disabled:opacity-40"
    >
      {busy ? "…" : "remix"}
    </button>
  );
}
