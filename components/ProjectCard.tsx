"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProjectCard({
  id,
  name,
  status,
  html,
}: {
  id: string;
  name: string;
  status: string;
  html: string | null;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const [busy, setBusy] = useState(false);

  async function rename() {
    const value = newName.trim();
    if (!value || value === name) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    await supabase.from("projects").update({ name: value }).eq("id", id);
    setBusy(false);
    setRenaming(false);
    router.refresh();
  }

  async function softDelete() {
    if (
      !confirm(
        `Delete "${name}"? It moves to your archive for 30 days, then it's gone for good.`,
      )
    )
      return;
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="group relative rounded-xl border border-line bg-paper p-4 transition hover:border-flame">
      <Link href={`/builder/${id}`} className="block">
        {/* Preview: mini render of the real site, or black if nothing built */}
        <div className="h-36 overflow-hidden rounded-lg border border-line bg-ink">
          {html ? (
            <iframe
              srcDoc={html}
              sandbox=""
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none h-[576px] w-[400%] origin-top-left scale-25 bg-paper"
              title=""
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-paper-dim text-white/40">
                nothing built yet
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {renaming ? null : (
              <p className="font-display truncate font-semibold">{name}</p>
            )}
            <p className="mt-1 text-xs tracking-widest text-faint uppercase">
              {status}
            </p>
          </div>
        </div>
      </Link>

      {renaming && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename()}
            autoFocus
            aria-label="New project name"
            className="w-full border-b-2 border-ink bg-transparent py-1 text-sm outline-none focus:border-flame"
          />
          <button
            onClick={rename}
            disabled={busy}
            className="text-sm font-medium text-flame disabled:opacity-40"
          >
            save
          </button>
        </div>
      )}

      {/* hover actions */}
      <div className="absolute top-3 right-3 flex gap-1 rounded-full border border-line bg-paper px-2 py-1 opacity-0 shadow-sm transition group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.preventDefault();
            setRenaming((r) => !r);
          }}
          disabled={busy}
          className="px-1.5 text-xs font-medium text-ink-soft transition hover:text-flame"
        >
          rename
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            softDelete();
          }}
          disabled={busy}
          className="px-1.5 text-xs font-medium text-ink-soft transition hover:text-flame"
        >
          delete
        </button>
      </div>
    </div>
  );
}
