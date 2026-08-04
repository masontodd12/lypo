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
  /**
   * What the priced rows are called. Drives the labels on the "menu" grid so
   * a barbershop is filling in services and a shop is filling in products,
   * not "menu items". Defaults to "item".
   */
  itemNoun?: "item" | "service" | "product";
  /**
   * Can be left blank. Most questions are required because a blank answer
   * means a missing section, but things like social links genuinely do not
   * apply to everyone and forcing an answer invites made-up ones.
   */
  optional?: boolean;
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

// A truck is not a restaurant with a smaller kitchen: it moves, so where it
// will be is the thing customers actually come to the site for.
const FOODTRUCK_INTERVIEW: Question[] = [
  {
    q: "what is the truck called",
    hint: "Exactly how it is painted on the truck.",
  },
  {
    q: "what kind of food do you serve",
    hint: "However you would describe it to someone in line. Birria, jerk, funnel cakes, coffee.",
  },
  {
    q: "where can people find you",
    hint: "Your regular spots, the markets or lots you park at, and which days. If it changes week to week, say that and where you post updates.",
    long: true,
  },
  {
    q: "your usual hours",
    hint: "Set the hours you normally serve on each day. Leave a day blank if you are not out.",
    kind: "hours",
  },
  {
    q: "your menu",
    hint: "Add each item and what it costs. Group them into sections like plates, sides, or drinks.",
    kind: "menu",
  },
  {
    q: "tell us your story",
    hint: "How the truck started, who runs it, what makes your food yours. This is what turns a passer-by into a regular.",
    long: true,
  },
  {
    q: "how do people reach you",
    hint: "Phone for catering or big orders, and the social account where you post your location.",
  },
];

// Every purpose below used to fall back to five generic questions, which is
// why those sites came out thin: the generator was never given anything
// specific enough to build a real page from. Each list stays at five to seven
// questions, and anything that genuinely does not apply to everyone is
// marked optional rather than forcing an invented answer.

const FUNDRAISER_INTERVIEW: Question[] = [
  {
    q: "who are you raising money for",
    hint: "Their name, and your relationship to them. If it is for a cause rather than a person, name the cause.",
  },
  {
    q: "what happened",
    hint: "Tell it plainly, the way you would tell a neighbor. This becomes the main section of the page, and it is what makes people give.",
    long: true,
  },
  {
    q: "what will the money pay for",
    hint: "Rent, medical bills, funeral costs, equipment. Be specific if you can. If you have a goal amount, put it here.",
  },
  {
    q: "how else can people help",
    hint: "Meals, rides, sharing the link, showing up. Leave blank if money is the only ask.",
    optional: true,
  },
  {
    q: "who is organizing this",
    hint: "Your name and how people can reach you. Donors want to know who is behind it.",
  },
];

const MEMORIAL_INTERVIEW: Question[] = [
  {
    q: "who are we remembering",
    hint: "Their full name, exactly as you want it written.",
  },
  {
    q: "their dates",
    hint: "Born and passed. Write it however you like, such as March 4 1951 to January 12 2026.",
  },
  {
    q: "tell us about their life",
    hint: "Where they grew up, family, work, what they loved, how people describe them. Take your time here. This becomes the heart of the page.",
    long: true,
  },
  {
    q: "service details",
    hint: "Date, time, and address of the service or celebration of life. Leave blank if it is private or not set yet.",
    optional: true,
  },
  {
    q: "flowers or donations",
    hint: "Where to send flowers, or a charity the family prefers instead. Leave blank if there is nothing to say.",
    optional: true,
  },
  {
    q: "who should people contact",
    hint: "A family member or friend handling questions, and how to reach them.",
  },
];

const CHURCH_INTERVIEW: Question[] = [
  {
    q: "what is your church called",
    hint: "Exactly how it appears on the sign or bulletin.",
  },
  {
    q: "when do you gather",
    hint: "Set your service and gathering times for each day. Leave a day blank if nothing happens then.",
    kind: "hours",
  },
  {
    q: "where are you",
    hint: "Full street address. We turn it into a map link visitors can open on their phone.",
  },
  {
    q: "what is a first visit like",
    hint: "How long is a service, what do people wear, where do they park, is there anything for kids? This is what nervous first-timers actually want to know.",
    long: true,
  },
  {
    q: "who are you as a church",
    hint: "Your tradition, what you believe, what you are known for in the neighborhood. In your own words.",
    long: true,
  },
  {
    q: "how do people reach you",
    hint: "Phone, email, or the pastor's office. Whatever you want on the page.",
  },
];

const BARBERSHOP_INTERVIEW: Question[] = [
  {
    q: "what is the shop called",
    hint: "Exactly how you want it written on the sign.",
  },
  {
    q: "what are you known for",
    hint: "Fades, locs, braids, kids' cuts, beard work, color. However you would describe it to a new client.",
  },
  {
    q: "your services and prices",
    hint: "Add each service and what it costs. Group them into sections like cuts, color, or kids.",
    kind: "menu",
    itemNoun: "service",
  },
  {
    q: "when are you open",
    hint: "Set your hours for each day. Leave a day blank if you are closed.",
    kind: "hours",
  },
  {
    q: "where are you located",
    hint: "Full street address. We turn it into a map link clients can open on their phone.",
  },
  {
    q: "how do people book",
    hint: "Phone number, booking site, walk-ins only, or all three. We make phone numbers tap-to-call.",
  },
];

const BUSINESS_INTERVIEW: Question[] = [
  {
    q: "what is your business called",
    hint: "Exactly how you want it written.",
  },
  {
    q: "what do you do",
    hint: "In plain words, the way you would say it to someone at a cookout. Not a mission statement.",
  },
  {
    q: "who is it for",
    hint: "Homeowners, small businesses, new parents, event planners. Being specific here makes the whole site sharper.",
  },
  {
    q: "your services and prices",
    hint: "Add each service and what it costs. Leave a price blank if it depends on the job.",
    kind: "menu",
    itemNoun: "service",
  },
  {
    q: "why should someone pick you",
    hint: "Years in business, what you do differently, licenses or certifications, the thing customers always say. Real facts only.",
    long: true,
  },
  {
    q: "when are you available",
    hint: "Set your hours for each day. Leave a day blank if you are closed.",
    kind: "hours",
  },
  {
    q: "how do people reach you",
    hint: "Phone, email, and address if customers come to you. We make phone numbers tap-to-call.",
  },
];

const EVENT_INTERVIEW: Question[] = [
  {
    q: "what is the event called",
    hint: "The name people will see on the invite.",
  },
  {
    q: "what is it",
    hint: "What actually happens, who it is for, and why someone should come. Describe the day.",
    long: true,
  },
  {
    q: "when is it",
    hint: "Date and start time. Include an end time if you have one.",
  },
  {
    q: "where is it",
    hint: "Venue name and full street address. We turn it into a map link.",
  },
  {
    q: "what should people know before coming",
    hint: "Cost, parking, what to bring, whether kids are welcome, dress code. Leave blank if none of it applies.",
    optional: true,
  },
  {
    q: "who is hosting",
    hint: "Your name or organization, and how people can reach you with questions.",
  },
];

const SPORTS_INTERVIEW: Question[] = [
  {
    q: "what is the team called",
    hint: "Team name, and the league or association if you are in one.",
  },
  {
    q: "who plays",
    hint: "Age group, grade range, boys, girls, or both. Anyone can try out or is it selective?",
  },
  {
    q: "when do you practice",
    hint: "Set practice times for each day. Leave a day blank if there is no practice.",
    kind: "hours",
  },
  {
    q: "where do you practice and play",
    hint: "Field or gym name and address. We turn it into a map link for parents.",
  },
  {
    q: "the season and schedule",
    hint: "When the season runs, key game dates, tournaments. Whatever you know so far.",
    long: true,
  },
  {
    q: "who should parents contact",
    hint: "Coach or team manager name, phone, and email.",
  },
  {
    q: "team colors",
    hint: "We use them as the accent on the site. Leave blank and we will pick something.",
    optional: true,
  },
];

const COMMUNITY_INTERVIEW: Question[] = [
  {
    q: "what is the group called",
    hint: "Exactly how you want it written.",
  },
  {
    q: "what does the group do",
    hint: "What you actually get together and do, how it started, and who it is for. Real details beat a slogan.",
    long: true,
  },
  {
    q: "when do you meet",
    hint: "Set your meeting times for each day. Leave a day blank if you do not meet then.",
    kind: "hours",
  },
  {
    q: "where do you meet",
    hint: "Address, or online. We turn addresses into a map link.",
  },
  {
    q: "how does someone join",
    hint: "Just show up, fill out a form, pay dues, message you first? Say exactly what to do.",
  },
  {
    q: "who should people contact",
    hint: "A name and a way to reach them.",
  },
];

const PORTFOLIO_INTERVIEW: Question[] = [
  {
    q: "what is your name",
    hint: "How you want it to appear at the top of the site.",
  },
  {
    q: "what do you make",
    hint: "Photography, design, writing, woodworking, music. One plain line a stranger would understand.",
  },
  {
    q: "tell us about you",
    hint: "How you got into it, how you work, who you work with, where you are based. This becomes your about section.",
    long: true,
  },
  {
    q: "the work you want to show",
    hint: "Name the pieces or projects and say a sentence about each. If you upload photos on the next screen we will lay them out.",
    long: true,
  },
  {
    q: "are you taking work",
    hint: "Booking, commissions, full-time roles, or just showing. Say what you want people to ask for.",
  },
  {
    q: "how do people reach you",
    hint: "Email, phone, or the social account you actually check.",
  },
];

const SHOP_INTERVIEW: Question[] = [
  {
    q: "what is your shop called",
    hint: "Exactly how you want it written.",
  },
  {
    q: "what do you make or sell",
    hint: "Candles, jewelry, baked goods, prints. In plain words.",
  },
  {
    q: "your products and prices",
    hint: "Add each product and what it costs. Group them into sections if you have ranges.",
    kind: "menu",
    itemNoun: "product",
  },
  {
    q: "how do people order",
    hint: "Message you, pickup, local delivery, shipping, a market you sell at. Say exactly what to do.",
  },
  {
    q: "who makes this",
    hint: "Your story. Who you are, how you started, what makes your work yours. This is what makes a small shop feel real.",
    long: true,
  },
  {
    q: "how do people reach you",
    hint: "Email, phone, or the social account you actually check.",
  },
];

const PERSONAL_INTERVIEW: Question[] = [
  {
    q: "what is your name",
    hint: "How you want it at the top of the page.",
  },
  {
    q: "who are you",
    hint: "What you do, what you care about, where you are. Write it the way you would introduce yourself, not like a resume.",
    long: true,
  },
  {
    q: "what are you into",
    hint: "Projects, hobbies, causes, things you are learning. Whatever you want people to know.",
  },
  {
    q: "links you want on there",
    hint: "Social accounts, a newsletter, a project, your work. Leave blank if you would rather not.",
    optional: true,
  },
  {
    q: "how can people reach you",
    hint: "Email or a social account. Leave blank if you do not want to be contacted.",
    optional: true,
  },
];

const LANDING_INTERVIEW: Question[] = [
  {
    q: "what is the idea called",
    hint: "The name, even if it is a working title.",
  },
  {
    q: "what is it, in one sentence",
    hint: "Say it so a stranger gets it immediately. No buzzwords.",
  },
  {
    q: "who is it for and what problem does it solve",
    hint: "Who has this problem today, and what do they do about it now? Be concrete.",
    long: true,
  },
  {
    q: "what should visitors do",
    hint: "Join a waitlist, request early access, book a call. Pick the one action that matters most.",
  },
  {
    q: "what happens after they sign up",
    hint: "When you will contact them, and what they get. Setting this expectation is what makes people trust a new idea.",
  },
  {
    q: "who is behind it",
    hint: "Your name, your team, and why you are the one building this.",
  },
];

export const INTERVIEWS: Record<string, Question[]> = {
  restaurant: RESTAURANT_INTERVIEW,
  foodtruck: FOODTRUCK_INTERVIEW,
  fundraiser: FUNDRAISER_INTERVIEW,
  memorial: MEMORIAL_INTERVIEW,
  church: CHURCH_INTERVIEW,
  barbershop: BARBERSHOP_INTERVIEW,
  business: BUSINESS_INTERVIEW,
  event: EVENT_INTERVIEW,
  sports: SPORTS_INTERVIEW,
  community: COMMUNITY_INTERVIEW,
  portfolio: PORTFOLIO_INTERVIEW,
  shop: SHOP_INTERVIEW,
  personal: PERSONAL_INTERVIEW,
  landing: LANDING_INTERVIEW,
};

export function getInterview(purpose?: string | null): Question[] {
  return INTERVIEWS[purpose ?? ""] ?? INTERVIEW;
}
