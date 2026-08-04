"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "lypo-theme";

/** Only the builder is themeable. The public site is always light. */
export const THEMED_PATH_PREFIX = "/builder";

/**
 * Runs before first paint (see layout.tsx) so opening the builder in dark
 * mode never flashes white. Scoped by pathname so the marketing pages,
 * which are designed light, are never darkened.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (location.pathname.indexOf(${JSON.stringify(THEMED_PATH_PREFIX)}) !== 0) return;
    var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (t !== "dark" && t !== "light") {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
`.trim();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/**
 * Applies the theme while the builder is mounted and clears it on the way
 * out, so a client-side navigation back to the dashboard or landing page
 * does not leave them stuck in dark mode.
 */
export function BuilderTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", readTheme());
    root.classList.add("theme-ready");
    return () => {
      root.removeAttribute("data-theme");
      root.classList.remove("theme-ready");
    };
  }, []);

  return null;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  // The real value is set by the inline script, so read it back rather than
  // assuming; otherwise the button would show the wrong label.
  useEffect(() => {
    setTheme(
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light",
    );
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing. The theme still applies for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`shrink-0 rounded-full border border-line p-1.5 text-ink-soft transition hover:border-flame hover:text-flame ${className}`}
    >
      {theme === "dark" ? (
        // Sun: clicking returns you to light.
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
