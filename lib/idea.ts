/**
 * Reading the one line someone typed on the homepage.
 *
 * "a website for my barbershop, Fade Factory in Memphis" should start the
 * builder with the name Fade Factory and barbershop already suggested, not a
 * name box holding the first forty characters of the sentence.
 */

const JOINERS = new Set(["of", "the", "and", "&", "de", "la", "for"]);

/**
 * The business name in the idea, if one was given: the first run of two or
 * more capitalised words. One capitalised word on its own is too often a
 * city ("in Memphis") or the start of the sentence to trust.
 */
export function nameFromIdea(idea: string | null | undefined): string | null {
  if (!idea) return null;
  const words = idea.split(/\s+/).map((w) => w.replace(/[,.;:!?]+$/, ""));
  let best: string[] = [];
  let run: string[] = [];
  const flush = () => {
    while (run.length && JOINERS.has(run[run.length - 1].toLowerCase())) run.pop();
    if (run.length >= 2 && best.length === 0) best = run;
    run = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const capital = /^[A-Z0-9][\w'&.-]*$/.test(w) && /[A-Za-z]/.test(w);
    if (capital) run.push(w);
    else if (run.length && JOINERS.has(w.toLowerCase())) run.push(w);
    else flush();
    // A comma ends a name: "Fade Factory, Memphis" is two things.
    if (/[,;:]$/.test(idea.split(/\s+/)[i] ?? "")) flush();
  }
  flush();
  const name = best.join(" ").trim();
  return name.length >= 3 && name.length <= 60 ? name : null;
}

const TYPE_WORDS: [string, RegExp][] = [
  ["barbershop", /\b(barber|salon|hair|nails?|braids?|lash|beauty|stylist)/i],
  ["foodtruck", /\bfood ?truck/i],
  ["restaurant", /\b(restaurant|cafe|café|diner|bakery|pizz|grill|bbq|coffee|kitchen|bistro)/i],
  ["church", /\b(church|ministry|worship|congregation|parish|mosque|temple|synagogue)/i],
  ["fundraiser", /\b(fundrais|donat|gofundme|raise money|charity)/i],
  ["memorial", /\b(memorial|funeral|celebration of life|in memory|obituary)/i],
  ["sports", /\b(team|league|soccer|football|basketball|baseball|softball|volleyball)/i],
  ["event", /\b(event|wedding|party|reunion|rsvp|conference|gala)/i],
  ["portfolio", /\b(portfolio|photograph|artist|designer|my work)/i],
  ["community", /\b(community|club|neighborhood|neighbourhood|block|association|volunteer)/i],
  ["shop", /\b(shop|store|products|merch|boutique)/i],
  ["landing", /\b(launch|startup|app idea|waitlist|landing)/i],
];

/** The business type the idea most plainly describes, or null. */
export function typeFromIdea(idea: string | null | undefined): string | null {
  if (!idea) return null;
  for (const [id, re] of TYPE_WORDS) if (re.test(idea)) return id;
  return null;
}
