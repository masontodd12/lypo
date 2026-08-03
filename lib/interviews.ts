// The interview questions, pulled out of BuilderChat so the paste-everything
// extractor on the server can target the same questions the user would have
// been asked. The server owns this list, so a client cannot make up questions.

export type Question = {
  q: string;
  hint: string;
  long?: boolean;
  /**
   * "menu" swaps the textarea for a structured item + price list.
   * "hours" swaps it for a day-by-day open/close time list.
   */
  kind?: "menu" | "hours";
};

export const INTERVIEW: Question[] = [
  { q: "what's it called?", hint: "The name of your site, business, group, or idea." },
  { q: "who is it for?", hint: "Who should visit this: customers, neighbors, friends, donors?" },
  { q: "what should it say?", hint: "The main message, story, or info visitors need to know." },
  { q: "what should visitors do?", hint: "Sign up? Donate? Contact you? Browse your work?" },
  { q: "anything else?", hint: "Colors you love, sections you want, vibes, details, anything." },
];

// Purpose-specific interviews. A restaurant needs different questions than a
// portfolio, and asking the right ones is most of what makes the site good.
export const RESTAURANT_INTERVIEW: Question[] = [
  {
    q: "what is the restaurant called",
    hint: "Exactly how you want it written on the sign.",
  },
  {
    q: "what kind of food do you serve",
    hint: "However you would describe it to a customer. Soul food, tacos, wings, Caribbean, coffee and pastries.",
  },
  {
    q: "tell us your story",
    hint: "How did it start, who is behind it, and what makes it yours? This becomes the main section of your home page, so real details work better than a slogan.",
    long: true,
  },
  {
    q: "when are you open",
    hint: "Set your hours for each day. Leave a day blank if you are not sure yet.",
    kind: "hours",
  },
  {
    q: "where are you located",
    hint: "Full street address. We turn it into a map link customers can open on their phone.",
  },
  {
    q: "what number should customers call",
    hint: "For orders or reservations. We make it tap-to-call on phones.",
  },
  {
    q: "your menu",
    hint: "Add each item and what it costs. Group them into sections like appetizers, plates, or drinks.",
    kind: "menu",
  },
];

export const INTERVIEWS: Record<string, Question[]> = {
  restaurant: RESTAURANT_INTERVIEW,
  foodtruck: RESTAURANT_INTERVIEW,
};

export function getInterview(purpose?: string | null): Question[] {
  return INTERVIEWS[purpose ?? ""] ?? INTERVIEW;
}
