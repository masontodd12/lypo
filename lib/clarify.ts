import { MODEL } from "@/lib/model";

/**
 * Asks the owner about missing facts instead of guessing at them.
 *
 * A generated page once shipped "[add price]" next to three services, which
 * is the kind of thing a real customer sees. The generator is told never to
 * write a placeholder, but a rule alone only decides what it does when a fact
 * is missing, not whether the fact is missing. This closes the other half:
 * find the gaps before building and let the owner fill them.
 *
 * Cheap and best-effort. A failure here returns no questions and the build
 * goes ahead, because a site built from a thin brief beats a build that
 * refuses to start.
 */

export type ClarifyQuestion = { id: string; question: string; why: string };

const MAX_QUESTIONS = 4;

const SYSTEM = `You review a brief that someone wrote about their business, before a website is generated from it.

Your only job is to find facts that are MISSING and that would leave a visible hole in the finished page. You do not write the site.

Return JSON: {"questions":[{"id":"kebab-case-id","question":"...","why":"..."}]}

Most briefs need one or two questions. Many need none. An empty array is a good answer and you should return it whenever the brief already covers what a page needs. Asking nothing is always better than asking something they do not need to answer.

Before you ask anything, you must be able to point at a specific thing that WILL appear on the site and WILL look unfinished without the answer. The clearest case by far: the brief lists several items of one kind, gives a detail for most of them, and omits it for the rest. Four services with a price and two without means you ask about those two, by name. That is the pattern to look for first.

Also worth asking, but only when genuinely absent from the brief: where the place is, when it is open, how to reach them.

Do NOT ask about any of these. They are not holes, and asking about them wastes the owner's time:
- Anything about design, colors, fonts, layout, tone, or what they want the site to feel like.
- Payment methods, accessibility, parking, cancellation or deposit policies, insurance, licences.
- Whether a listed price is a starting price or fixed, or whether prices vary by staff member. Take what they wrote at face value.
- Staff specialities, bios, credentials or history, unless the brief names a staff page and says nothing whatsoever about the people.
- Social media, email newsletters, loyalty schemes, gift cards.
- Anything they already answered. Read the whole brief before deciding something is missing.
- Anything you could reasonably leave off the page. If the site reads fine without it, it is not a gap.

Rules for the questions themselves:
- At most ${MAX_QUESTIONS}, ordered most important first. Fewer is better.
- Write them the way a person asks out loud, naming the specific thing: "What do you charge for a kids' cut?" not "Please provide pricing information."
- One thing per question. No parenthetical follow-ups, no "and" joining two asks.
- "why" is a short half-sentence saying what it is for, like "so the services page is complete". Lowercase, no period.
- Every question must be answerable in a few words.`;

export async function findGaps(
  brief: string,
  purpose: string | null,
  pages: string[],
): Promise<ClarifyQuestion[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || brief.trim().length < 40) return [];

  const context = [
    purpose ? `Type of site: ${purpose}.` : "",
    pages.length ? `Pages being built: home, ${pages.join(", ")}.` : "",
    "",
    "The brief:",
    brief.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: context },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) return [];

    const parsed = JSON.parse(raw) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) return [];

    const seen = new Set<string>();
    return parsed.questions
      .flatMap((q) => {
        const row = q as Record<string, unknown>;
        const question = typeof row.question === "string" ? row.question : "";
        if (!question.trim() || question.length > 200) return [];
        const id =
          typeof row.id === "string" && row.id.trim()
            ? row.id.slice(0, 60)
            : question.slice(0, 40);
        if (seen.has(id)) return [];
        seen.add(id);
        return [
          {
            id,
            question: question.trim(),
            why: typeof row.why === "string" ? row.why.trim().slice(0, 90) : "",
          },
        ];
      })
      .slice(0, MAX_QUESTIONS);
  } catch {
    // Never let this block a build.
    return [];
  }
}
