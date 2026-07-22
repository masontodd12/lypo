"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "a signup site for my community food drive",
  "a portfolio for my photography",
  "a page for my church youth group",
  "a site to collect donations for our shelter",
];

export function PromptCta() {
  const router = useRouter();
  const [idea, setIdea] = useState("");

  function start(text: string) {
    const value = text.trim();
    router.push(
      value ? `/onboarding?idea=${encodeURIComponent(value)}` : "/onboarding",
    );
  }

  return (
    <div className="relative z-10 mx-auto mt-12 max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(idea);
        }}
        className="flex items-center gap-2 rounded-2xl border border-ink-soft bg-ink-soft p-2 shadow-[0_0_60px_-20px_#e8542f66] focus-within:border-flame"
      >
        <input
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="I want to build…"
          aria-label="Describe what you want to build"
          className="w-full bg-transparent px-4 py-3 text-paper outline-none placeholder:text-paper-dim"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-flame px-6 py-3 font-display font-bold text-paper transition hover:bg-flame-bright hover:text-ink"
        >
          Build it
        </button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => start(example)}
            className="rounded-full border border-ink-soft px-3 py-1.5 text-xs text-paper-dim transition hover:border-flame hover:text-paper"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}