"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { releaseSlug, setFeatured, unpublishSite } from "../actions";

export type AdminSite = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  featured: boolean;
  ownerEmail: string | null;
  liveUrl: string | null;
  updatedAt: string | null;
};

export function SiteRow({ site }: { site: AdminSite }) {
  const [pending, startTransition] = useTransition();
  const [featured, setFeaturedLocal] = useState(site.featured);

  // Taking a site offline or freeing its address is visible to the owner
  // and their visitors, so both confirm first. Featuring is reversible in
  // one click and does not.
  function confirmThen(message: string, run: () => Promise<void>) {
    if (!confirm(message)) return;
    startTransition(() => {
      void run();
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-display truncate text-sm font-semibold">
          {site.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-faint">
          {site.ownerEmail ?? "no owner email"}
          {site.slug && ` · ${site.slug}`}
          {` · ${site.status}`}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
        {site.liveUrl && (
          <a
            href={site.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink-soft transition hover:text-flame"
          >
            view ↗
          </a>
        )}
        <Link
          href={`/builder/${site.id}`}
          className="font-medium text-ink-soft transition hover:text-flame"
        >
          open
        </Link>

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
                () => unpublishSite(site.id),
              )
            }
            className="font-medium text-ink-soft transition hover:text-flame disabled:opacity-40"
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
                () => releaseSlug(site.id),
              )
            }
            className="font-medium text-ink-soft transition hover:text-flame disabled:opacity-40"
          >
            free address
          </button>
        )}
      </div>
    </div>
  );
}
