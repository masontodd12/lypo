"use client";

import { useEffect } from "react";

/**
 * Navigates the page when the site inside the iframe asks to change page.
 *
 * The published site runs in a sandboxed iframe, and that sandbox does not
 * include allow-top-navigation, so the frame setting window.top.location is
 * blocked by the browser and clicking a nav link did nothing at all. Rather
 * than widen the sandbox, the frame posts a message and this listener, which
 * is not sandboxed, does the navigating.
 *
 * The message is treated as untrusted even though it comes from our own
 * markup: only a plain page name is accepted, and it is only ever used to
 * build a path on this same origin, never a whole URL.
 */
export function SiteNavBridge({ base }: { base: string }) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const page = (e.data as { lypoNavigate?: unknown })?.lypoNavigate;
      if (typeof page !== "string") return;

      // A page name, nothing else. No slashes, no scheme, no traversal.
      if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(page)) return;

      const path =
        page === "home" ? base || "/" : `${base}/${page.toLowerCase()}`;
      window.location.href = path;
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [base]);

  return null;
}
