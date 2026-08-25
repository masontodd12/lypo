"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  archiveSite,
  changeSlug,
  deleteSiteForever,
  releaseSlug,
  renameSite,
  setCustomDomainAllowed,
  setFeatured,
  unpublishSite,
  type ActionResult,
} from "../actions";

export type AdminSite = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  featured: boolean;
  ownerEmail: string | null;
  liveUrl: string | null;
  updatedAt: string | null;
  customDomain: string | null;
  customDomainAllowed: boolean;
};

/** Shared styling for the small text controls at the end of the row. */
const ACTION =
  "font-medium text-ink-soft transition hover:text-flame disabled:opacity-40";

export function SiteRow({ site }: { site: AdminSite }) {
  const [, startTransition] = useTransition();
  const [featured, setFeaturedLocal] = useState(site.featured);
  // Tracked separately from useTransition's flag, which goes false as soon
  // as the callback returns rather than when the action resolves. Relying on
  // it would flash "saving..." for a frame and then re-enable the buttons
  // while the write was still in flight.
  const [pending, setPending] = useState(false);
  const [domainAllowed, setDomainAllowed] = useState(site.customDomainAllowed);
  const [error, setError] = useState("");

  // Which inline editor is open, if any. Editing happens in the row rather
  // than behind a prompt() so the current value is visible while it is
  // being changed, and so a mistyped address can be corrected before it is
  // submitted rather than after it is live.
  const [editing, setEditing] = useState<null | "name" | "slug">(null);
  const [draft, setDraft] = useState("");

  // Removed from the list optimistically, because the row's own actions are
  // what took it out of the board and leaving it sitting there until the
  // page revalidates reads as the click not having worked.
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError("");
    setPending(true);
    void action()
      .then((result) => {
        if (result.ok) onDone?.();
        else setError(result.error);
        // Pulls the server component's fresh data down after the write.
        startTransition(() => {});
      })
      .catch(() => setError("That did not go through. Try again."))
      .finally(() => setPending(false));
  }

  function confirmThen(message: string, go: () => void) {
    if (!confirm(message)) return;
    go();
  }

  function openEditor(which: "name" | "slug") {
    setEditing(which);
    setDraft(which === "name" ? site.name : (site.slug ?? ""));
    setError("");
  }

  if (editing) {
    const isName = editing === "name";
    return (
      <form
        className="px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          const value = draft.trim();
          if (!value) return;
          run(
            () =>
              isName
                ? renameSite(site.id, value)
                : changeSlug(site.id, value),
            () => setEditing(null),
          );
        }}
      >
        <label
          htmlFor={`${editing}-${site.id}`}
          className="text-xs text-faint"
        >
          {isName
            ? "name shown to the owner and in the gallery"
            : "address, the part before .lypo.dev"}
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            id={`${editing}-${site.id}`}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(null);
            }}
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-flame"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-lg bg-flame px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "saving…" : "save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setError("");
            }}
            className="text-xs text-faint transition hover:text-flame"
          >
            cancel
          </button>
        </div>
        {!isName && site.slug && (
          <p className="mt-1.5 text-xs text-faint">
            Changing this breaks every link already shared to{" "}
            <span className="font-mono">{site.slug}</span>.
          </p>
        )}
        {error && <p className="mt-1.5 text-xs text-flame">{error}</p>}
      </form>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display truncate text-sm font-semibold">
            {site.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-faint">
            {site.ownerEmail ?? "no owner email"}
            {site.slug && ` · ${site.slug}`}
            {` · ${site.status}`}
            {site.customDomain && ` · ${site.customDomain}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
          {site.liveUrl && (
            <a
              href={site.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTION}
            >
              view ↗
            </a>
          )}
          <Link href={`/builder/${site.id}`} className={ACTION}>
            open
          </Link>

          <button
            type="button"
            disabled={pending}
            onClick={() => openEditor("name")}
            className={ACTION}
          >
            rename
          </button>

          {site.slug && (
            <button
              type="button"
              disabled={pending}
              onClick={() => openEditor("slug")}
              className={ACTION}
            >
              address
            </button>
          )}

          {/* Bringing your own domain is self-serve, so this is only ever
              used to take it away from a site that is abusing it. Shown as
              an off switch rather than a grant, and only called out once it
              has actually been used. */}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const blocking = domainAllowed;
              const ask = !blocking
                ? `Let "${site.name}" connect its own domain again?`
                : site.customDomain
                  ? `Block custom domains for "${site.name}"? ${site.customDomain} will be disconnected and the owner will not be able to reconnect it.`
                  : `Block custom domains for "${site.name}"? The owner will not be able to connect one.`;
              confirmThen(ask, () => {
                setDomainAllowed(!blocking);
                run(() => setCustomDomainAllowed(site.id, !blocking));
              });
            }}
            className={`font-medium transition disabled:opacity-40 ${
              domainAllowed
                ? "text-ink-soft hover:text-flame"
                : "text-flame"
            }`}
          >
            {domainAllowed ? "block domains" : "domains blocked"}
          </button>

          {site.status === "published" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const next = !featured;
                setFeaturedLocal(next);
                startTransition(() => {
                  void setFeatured(site.id, next);
                });
              }}
              className={`font-medium transition disabled:opacity-40 ${
                featured ? "text-flame" : "text-ink-soft hover:text-flame"
              }`}
            >
              {featured ? "featured" : "feature"}
            </button>
          )}

          {site.status === "published" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirmThen(
                  `Take "${site.name}" offline? Visitors will stop being able to reach it. Nothing is deleted.`,
                  () => run(async () => {
                    await unpublishSite(site.id);
                    return { ok: true };
                  }),
                )
              }
              className={ACTION}
            >
              take down
            </button>
          )}

          {site.slug && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirmThen(
                  `Free the address "${site.slug}"? The site goes offline and someone else can claim it.`,
                  () => run(async () => {
                    await releaseSlug(site.id);
                    return { ok: true };
                  }),
                )
              }
              className={ACTION}
            >
              free address
            </button>
          )}

          {/* Archiving is the ordinary way to remove a site: it lands in the
              owner's archive and can be restored for thirty days. */}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirmThen(
                `Archive "${site.name}"? It goes offline and lands in the owner's archive, where they can restore it for 30 days.`,
                () => run(() => archiveSite(site.id), () => setGone(true)),
              )
            }
            className={ACTION}
          >
            archive
          </button>

          {/* Permanent deletion is for spam and abuse, so it asks twice and
              the second question has to be answered by typing. */}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirmThen(
                `Delete "${site.name}" permanently? There is no archive and no undo.`,
                () => {
                  const typed = prompt(
                    `This cannot be undone. Type DELETE to remove "${site.name}" and everything attached to it.`,
                  );
                  if (typed !== "DELETE") return;
                  run(() => deleteSiteForever(site.id), () => setGone(true));
                },
              )
            }
            className="font-medium text-flame transition hover:underline disabled:opacity-40"
          >
            delete
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-flame">{error}</p>}
    </div>
  );
}
