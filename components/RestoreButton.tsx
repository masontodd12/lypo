"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("projects").update({ deleted_at: null }).eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={restore}
      disabled={busy}
      className="rounded-full border border-line px-4 py-1.5 text-sm font-medium transition hover:border-flame hover:text-flame disabled:opacity-40"
    >
      {busy ? "restoring…" : "restore"}
    </button>
  );
}
