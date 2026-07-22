import Link from "next/link";

export const dynamic = "force-dynamic";

type Example = {
  name: string;
  kind: string;
  idea: string;
  preview: React.ReactNode;
};

function Chip({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="rounded px-2 py-1 text-[8px] font-medium" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

const EXAMPLES: Example[] = [
  {
    name: "Second Harvest",
    kind: "community food drive · volunteer signups",
    idea: "a warm community food drive website with volunteer signup form, Saturday hours, and what to donate",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#FFF6EC" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[9px] font-bold tracking-widest" style={{ color: "#5A3E28" }}>SECOND HARVEST</span>
          <Chip bg="#C96F3A" color="#fff">donate</Chip>
        </div>
        <p className="px-4 pt-4 text-[15px] leading-tight font-bold" style={{ color: "#3B2A1B", fontFamily: "Georgia, serif" }}>
          Neighbors feeding neighbors
        </p>
        <p className="px-4 pt-1 text-[8px]" style={{ color: "#8A7460" }}>Saturdays · 8:30 AM · Germantown Community Center</p>
        <div className="flex gap-1.5 px-4 pt-3">
          <Chip bg="#3B2A1B" color="#fff">volunteer</Chip>
          <Chip bg="#fff" color="#5A3E28">what we need</Chip>
        </div>
        <div className="mt-3 flex gap-1.5 px-4">
          <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
          <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
          <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
        </div>
      </div>
    ),
  },
  {
    name: "Mara Shoots",
    kind: "photography portfolio · booking requests",
    idea: "a dark editorial photography portfolio with a photo grid and a booking request form",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#111" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[9px] tracking-[0.3em] text-white">MARA SHOOTS</span>
          <span className="text-[8px]" style={{ color: "#D62828" }}>booking open</span>
        </div>
        <p className="px-4 pt-4 text-[17px] leading-tight text-white italic" style={{ fontFamily: "Georgia, serif" }}>
          Portraits with a pulse.
        </p>
        <p className="px-4 pt-1 text-[8px]" style={{ color: "#888" }}>Memphis photographer · weddings, seniors, brands</p>
        <div className="mt-3 grid grid-cols-3 gap-1 px-4">
          <div className="h-12 rounded-sm" style={{ background: "#2B2B2B" }} />
          <div className="h-12 rounded-sm" style={{ background: "#3A3A3A" }} />
          <div className="h-12 rounded-sm" style={{ background: "#242424" }} />
        </div>
        <p className="px-4 pt-2 text-[8px] text-white underline underline-offset-2">book a session →</p>
      </div>
    ),
  },
  {
    name: "SplitStack",
    kind: "expense-splitting web app · remembers your crew",
    idea: "a group expense splitting web app where friends log expenses and it calculates who owes who",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg p-3" style={{ background: "#0D0D0F" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white">SplitStack</span>
          <Chip bg="#1F2A1F" color="#4ADE80">all settled</Chip>
        </div>
        <p className="pt-2 text-[8px]" style={{ color: "#777" }}>trip total</p>
        <p className="text-[16px] font-bold text-white">$248.50</p>
        <div className="mt-2 space-y-1">
          {[
            ["jordan paid — pizza night", "+$62", "#4ADE80"],
            ["amara owes taylor", "$21.40", "#F87171"],
            ["dev owes jordan", "$13.33", "#F87171"],
          ].map(([label, amt, color]) => (
            <div key={label as string} className="flex items-center justify-between rounded px-2 py-1" style={{ background: "#17171A" }}>
              <span className="text-[8px] text-white">{label}</span>
              <span className="text-[8px]" style={{ color: color as string }}>{amt}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    name: "Fade Kings",
    kind: "barbershop · appointment requests",
    idea: "a bold barbershop website with prices, hours, and an appointment request form",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#FFD60A" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[10px] font-black" style={{ color: "#111" }}>FADE KINGS</span>
          <Chip bg="#111" color="#fff">book now</Chip>
        </div>
        <p className="px-4 pt-3 text-[19px] leading-[0.95] font-black uppercase" style={{ color: "#111" }}>
          Fresh cuts.<br />No waiting.
        </p>
        <p className="px-4 pt-1.5 text-[8px] font-medium" style={{ color: "#443B00" }}>Tue–Sat · walk-ins after 4 · Whitehaven</p>
        <div className="mt-2.5 flex gap-1.5 px-4">
          <Chip bg="#FF3B30" color="#fff">cuts $25</Chip>
          <Chip bg="#111" color="#fff">kids $15</Chip>
          <Chip bg="#fff" color="#111">beard $10</Chip>
        </div>
      </div>
    ),
  },
  {
    name: "Bright Pages",
    kind: "literacy nonprofit · signups + donations",
    idea: "a hopeful children's literacy nonprofit site with impact stats, volunteer signup, and book donation info",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#F1F5EC" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[9px] font-bold tracking-widest" style={{ color: "#2F3E2F" }}>BRIGHT PAGES</span>
          <Chip bg="#7CA982" color="#fff">give books</Chip>
        </div>
        <p className="px-4 pt-4 text-[15px] leading-tight font-bold" style={{ color: "#2F3E2F" }}>
          Every kid deserves a shelf of their own.
        </p>
        <div className="mt-3 flex gap-3 px-4">
          {[["12k", "books given"], ["40", "school partners"], ["200", "volunteers"]].map(([n, l]) => (
            <div key={l}>
              <p className="text-[13px] font-bold" style={{ color: "#2F3E2F" }}>{n}</p>
              <p className="text-[7px]" style={{ color: "#6B7F6B" }}>{l}</p>
            </div>
          ))}
        </div>
        <p className="px-4 pt-3 text-[8px] underline underline-offset-2" style={{ color: "#2F3E2F" }}>volunteer on sorting night →</p>
      </div>
    ),
  },
  {
    name: "Luz Candle Co.",
    kind: "small shop · product showcase + orders",
    idea: "an elegant handmade candle shop site with product showcase and order for pickup form",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#F7F5F1" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[9px] tracking-[0.25em]" style={{ color: "#22201C" }}>LUZ CANDLE CO.</span>
          <span className="text-[8px] italic" style={{ color: "#C9B896" }}>hand-poured</span>
        </div>
        <p className="px-4 pt-4 text-[16px] leading-tight italic" style={{ color: "#22201C", fontFamily: "Georgia, serif" }}>
          Small batches, warm light.
        </p>
        <div className="mt-3 flex gap-1.5 px-4">
          <div className="h-14 flex-1 rounded-sm" style={{ background: "#E8E2D6" }} />
          <div className="h-14 flex-1 rounded-sm" style={{ background: "#DDD3C0" }} />
          <div className="h-14 flex-1 rounded-sm" style={{ background: "#E4DACA" }} />
        </div>
        <p className="px-4 pt-2 text-[8px]" style={{ color: "#8A7F6A" }}>from $14 · order for pickup →</p>
      </div>
    ),
  },
  {
    name: "Northside Youth",
    kind: "mentorship program · parent signups",
    idea: "a friendly youth mentorship program site with sessions, mentor bios, and parent signup form",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#EEF4FB" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[9px] font-bold tracking-widest" style={{ color: "#1E3A5F" }}>NORTHSIDE YOUTH</span>
          <Chip bg="#2E6FDB" color="#fff">enroll</Chip>
        </div>
        <p className="px-4 pt-4 text-[15px] leading-tight font-bold" style={{ color: "#1E3A5F" }}>
          Big futures start with one mentor.
        </p>
        <p className="px-4 pt-1 text-[8px]" style={{ color: "#5B7699" }}>Tuesdays + Thursdays · grades 6–12 · always free for families</p>
        <div className="mt-3 flex gap-1.5 px-4">
          <div className="h-9 w-9 rounded-full" style={{ background: "#CFE0F5" }} />
          <div className="h-9 w-9 rounded-full" style={{ background: "#B9D2F0" }} />
          <div className="h-9 w-9 rounded-full" style={{ background: "#A3C4EB" }} />
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: "#2E6FDB", color: "#fff" }}>+12</div>
        </div>
        <p className="px-4 pt-2 text-[8px] underline underline-offset-2" style={{ color: "#1E3A5F" }}>meet the mentors →</p>
      </div>
    ),
  },
  {
    name: "El Fuego Taqueria",
    kind: "restaurant · menu + hours",
    idea: "a vibrant taqueria website with the menu, hours, location, and photos",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#7A1E1E" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[10px] font-black tracking-wide" style={{ color: "#FFD9A0" }}>EL FUEGO</span>
          <Chip bg="#FFD9A0" color="#7A1E1E">open til 10</Chip>
        </div>
        <p className="px-4 pt-3 text-[17px] leading-tight font-black" style={{ color: "#FFF3E0" }}>
          Tacos worth the line.
        </p>
        <div className="mt-3 space-y-1 px-4">
          {[["al pastor", "$3.50"], ["birria (3) + consomé", "$12"], ["agua fresca", "$3"]].map(([item, price]) => (
            <div key={item} className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: "#96393930" }}>
              <span className="text-[8px]" style={{ color: "#FFE8C7" }}>{item}</span>
              <span className="text-[8px] font-bold" style={{ color: "#FFD9A0" }}>{price}</span>
            </div>
          ))}
        </div>
        <p className="px-4 pt-2 text-[8px]" style={{ color: "#E8B98C" }}>Summer Ave · daily 11–10</p>
      </div>
    ),
  },
  {
    name: "Groove City Records",
    kind: "record shop · retro storefront",
    idea: "a retro 70s-styled record shop website with new arrivals, trade-in info, and store hours",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#F4E1C6" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[10px] font-black" style={{ color: "#2A9D8F" }}>GROOVE CITY</span>
          <Chip bg="#E76F51" color="#fff">new crates fri</Chip>
        </div>
        <p className="px-4 pt-3 text-[17px] leading-tight font-black" style={{ color: "#5A3212" }}>
          Vinyl never left.
        </p>
        <p className="px-4 pt-1 text-[8px]" style={{ color: "#8A6B45" }}>buy · sell · trade · listen before you cop</p>
        <div className="mt-3 flex gap-1.5 px-4">
          <div className="h-12 w-12 rounded-sm" style={{ background: "#E76F51" }} />
          <div className="h-12 w-12 rounded-sm" style={{ background: "#2A9D8F" }} />
          <div className="h-12 w-12 rounded-sm" style={{ background: "#B5651D" }} />
          <div className="h-12 w-12 rounded-sm" style={{ background: "#264653" }} />
        </div>
      </div>
    ),
  },
  {
    name: "Study Sprint",
    kind: "study timer web app · tracks your streak",
    idea: "a focus timer web app for students with pomodoro sessions, subject tracking, and a study streak counter",
    preview: (
      <div className="h-40 overflow-hidden rounded-lg p-3 text-center" style={{ background: "#141420" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-white">Study Sprint</span>
          <Chip bg="#2A2A3E" color="#A78BFA">6-day streak</Chip>
        </div>
        <p className="pt-3 text-[26px] font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>24:59</p>
        <p className="text-[8px]" style={{ color: "#8888A5" }}>AP Chem · sprint 2 of 4</p>
        <div className="mx-auto mt-2 h-1.5 w-4/5 rounded-full" style={{ background: "#2A2A3E" }}>
          <div className="h-1.5 rounded-full" style={{ background: "#A78BFA", width: "62%" }} />
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          <Chip bg="#A78BFA" color="#141420">pause</Chip>
          <Chip bg="#2A2A3E" color="#fff">skip break</Chip>
        </div>
      </div>
    ),
  },
];

export default function Gallery() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      <header className="flex items-center justify-between py-8">
        <Link href="/" className="font-display text-sm font-semibold tracking-[0.4em]">
          LYPO<span className="text-flame">.</span>
        </Link>
        <Link href="/onboarding" className="text-sm font-medium transition hover:text-flame">
          build your own →
        </Link>
      </header>

      <section className="pb-24 pt-10">
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          built with lypo<span className="text-flame">.</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          The kinds of things people make here. See one that feels like yours?
          Start from it and make it your own.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((example) => (
            <div key={example.name} className="rounded-xl border border-line bg-paper p-4 transition hover:border-flame">
              {example.preview}
              <div className="mt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display truncate font-semibold">{example.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{example.kind}</p>
                </div>
                <Link
                  href={`/onboarding?idea=${encodeURIComponent(example.idea)}`}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:border-flame hover:text-flame"
                >
                  start from this
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-faint">
          Every one of these starts as a sentence and a vibe. Yours will too.
        </p>
      </section>
    </main>
  );
}
