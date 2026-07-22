import Link from "next/link";
import { PromptCta } from "@/components/PromptCta";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen">
      {/* ---------- Nav ---------- */}
      <header className="mx-auto flex max-w-6xl items-start justify-between px-6 pt-8">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.4em]"
        >
          LYPO<span className="text-flame">.</span>
        </Link>
        <nav className="text-right text-sm leading-7 font-medium">
          <Link href="#how" className="block transition hover:text-flame">
            how it works
          </Link>
          <Link href="#mission" className="block transition hover:text-flame">
            our mission
          </Link>
          <Link href="#examples" className="block transition hover:text-flame">
            examples
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="block font-medium text-flame transition hover:text-flame-bright"
            >
              my projects →
            </Link>
          ) : (
            <Link href="/login" className="block transition hover:text-flame">
              sign in
            </Link>
          )}
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-28 pb-24 sm:pt-36">
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft sm:ml-[42%]">
          Real websites and apps, built by describing them in plain words. No
          code. No gatekeeping. Made for the people tech usually leaves out.
        </p>

        <h1 className="font-display mt-12 text-7xl leading-[0.95] font-semibold tracking-tighter sm:text-[9rem]">
          just
          <br />
          build it<span className="text-flame">.</span>
        </h1>

        <div className="mt-4 sm:flex sm:justify-end">
          <PromptCta />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-14 sm:grid-cols-3">
            {[
              {
                n: "01",
                step: "describe",
                body: "Say what you want in plain words. A signup page for your food drive. A portfolio. An app that splits expenses with your friends. If you can say it, you can build it.",
              },
              {
                n: "02",
                step: "shape",
                body: "It appears live in front of you. Change anything by asking — \u201Cmake it warmer,\u201D \u201Cadd a donate button.\u201D No tutorials, no manuals, no experience needed.",
              },
              {
                n: "03",
                step: "publish",
                body: "Pick your link and put it on the internet in one click. Your idea, live, today — not someday.",
              },
            ].map((item) => (
              <div key={item.n}>
                <p className="text-xs tracking-widest text-faint">{item.n}</p>
                <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                  {item.step}
                  <span className="text-flame">.</span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Examples strip ---------- */}
      <section id="examples" className="border-t border-line bg-mist/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            built with lypo<span className="text-flame">.</span>
          </h2>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Real kinds of things real people make here — described in a
            sentence, live the same day.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {/* --- Second Harvest: warm community food drive --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#FFF6EC" }}>
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-[9px] font-bold tracking-widest" style={{ color: "#5A3E28" }}>SECOND HARVEST</span>
                  <span className="rounded-full px-2 py-0.5 text-[8px] text-white" style={{ background: "#C96F3A" }}>donate</span>
                </div>
                <p className="px-4 pt-4 text-[15px] leading-tight font-bold" style={{ color: "#3B2A1B", fontFamily: "Georgia, serif" }}>
                  Neighbors feeding neighbors
                </p>
                <p className="px-4 pt-1 text-[8px] leading-relaxed" style={{ color: "#8A7460" }}>
                  Saturdays · 8:30 AM · Germantown Community Center
                </p>
                <div className="flex gap-1.5 px-4 pt-3">
                  <span className="rounded px-2 py-1 text-[8px] text-white" style={{ background: "#3B2A1B" }}>volunteer</span>
                  <span className="rounded border px-2 py-1 text-[8px]" style={{ borderColor: "#C9B8A8", color: "#5A3E28" }}>what we need</span>
                </div>
                <div className="mt-3 flex gap-1.5 px-4">
                  <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
                  <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
                  <div className="h-8 flex-1 rounded" style={{ background: "#F2E4D5" }} />
                </div>
              </div>
              <p className="font-display mt-4 font-semibold">Second Harvest</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                food drive · collects volunteer signups
              </p>
            </div>

            {/* --- Mara Shoots: dark editorial portfolio --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#111111" }}>
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-[9px] tracking-[0.3em] text-white">MARA SHOOTS</span>
                  <span className="text-[8px]" style={{ color: "#D62828" }}>booking open</span>
                </div>
                <p className="px-4 pt-4 text-[17px] leading-tight text-white italic" style={{ fontFamily: "Georgia, serif" }}>
                  Portraits with a pulse.
                </p>
                <p className="px-4 pt-1 text-[8px]" style={{ color: "#888" }}>
                  Memphis photographer · weddings, seniors, brands
                </p>
                <div className="mt-3 grid grid-cols-3 gap-1 px-4">
                  <div className="h-12 rounded-sm" style={{ background: "#2B2B2B" }} />
                  <div className="h-12 rounded-sm" style={{ background: "#3A3A3A" }} />
                  <div className="h-12 rounded-sm" style={{ background: "#242424" }} />
                </div>
                <p className="px-4 pt-2 text-[8px] text-white underline underline-offset-2">book a session →</p>
              </div>
              <p className="font-display mt-4 font-semibold">Mara Shoots</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                photography portfolio · takes booking requests
              </p>
            </div>

            {/* --- SplitStack: dark web app UI --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="h-40 overflow-hidden rounded-lg p-3" style={{ background: "#0D0D0F" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white">SplitStack</span>
                  <span className="rounded-full px-2 py-0.5 text-[8px]" style={{ background: "#1F2A1F", color: "#4ADE80" }}>
                    all settled
                  </span>
                </div>
                <p className="pt-2 text-[8px]" style={{ color: "#777" }}>trip total</p>
                <p className="text-[16px] font-bold text-white">$248.50</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between rounded px-2 py-1" style={{ background: "#17171A" }}>
                    <span className="text-[8px] text-white">jordan paid — pizza night</span>
                    <span className="text-[8px]" style={{ color: "#4ADE80" }}>+$62</span>
                  </div>
                  <div className="flex items-center justify-between rounded px-2 py-1" style={{ background: "#17171A" }}>
                    <span className="text-[8px] text-white">amara owes taylor</span>
                    <span className="text-[8px]" style={{ color: "#F87171" }}>$21.40</span>
                  </div>
                  <div className="flex items-center justify-between rounded px-2 py-1" style={{ background: "#17171A" }}>
                    <span className="text-[8px] text-white">dev owes jordan</span>
                    <span className="text-[8px]" style={{ color: "#F87171" }}>$13.33</span>
                  </div>
                </div>
              </div>
              <p className="font-display mt-4 font-semibold">SplitStack</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                expense-splitting web app · remembers your crew
              </p>
            </div>

            {/* --- Fade Kings: bold barbershop --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#FFD60A" }}>
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-[10px] font-black tracking-tight" style={{ color: "#111" }}>FADE KINGS</span>
                  <span className="rounded-full px-2 py-0.5 text-[8px] font-bold text-white" style={{ background: "#111" }}>book now</span>
                </div>
                <p className="px-4 pt-3 text-[19px] leading-[0.95] font-black uppercase" style={{ color: "#111" }}>
                  Fresh cuts.<br />No waiting.
                </p>
                <p className="px-4 pt-1.5 text-[8px] font-medium" style={{ color: "#443B00" }}>
                  Tue–Sat · walk-ins after 4 · Whitehaven
                </p>
                <div className="mt-2.5 flex gap-1.5 px-4">
                  <span className="rounded px-2 py-1 text-[8px] font-bold text-white" style={{ background: "#FF3B30" }}>cuts $25</span>
                  <span className="rounded px-2 py-1 text-[8px] font-bold text-white" style={{ background: "#111" }}>kids $15</span>
                  <span className="rounded px-2 py-1 text-[8px] font-bold" style={{ background: "#fff", color: "#111" }}>beard $10</span>
                </div>
              </div>
              <p className="font-display mt-4 font-semibold">Fade Kings</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                barbershop · takes appointment requests
              </p>
            </div>

            {/* --- Bright Pages: organic literacy nonprofit --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
              <div className="h-40 overflow-hidden rounded-lg" style={{ background: "#F1F5EC" }}>
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-[9px] font-bold tracking-widest" style={{ color: "#2F3E2F" }}>BRIGHT PAGES</span>
                  <span className="rounded-full px-2 py-0.5 text-[8px] text-white" style={{ background: "#7CA982" }}>give books</span>
                </div>
                <p className="px-4 pt-4 text-[15px] leading-tight font-bold" style={{ color: "#2F3E2F" }}>
                  Every kid deserves a shelf of their own.
                </p>
                <div className="mt-3 flex gap-3 px-4">
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#2F3E2F" }}>12k</p>
                    <p className="text-[7px]" style={{ color: "#6B7F6B" }}>books given</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#2F3E2F" }}>40</p>
                    <p className="text-[7px]" style={{ color: "#6B7F6B" }}>school partners</p>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#2F3E2F" }}>200</p>
                    <p className="text-[7px]" style={{ color: "#6B7F6B" }}>volunteers</p>
                  </div>
                </div>
                <p className="px-4 pt-3 text-[8px] underline underline-offset-2" style={{ color: "#2F3E2F" }}>
                  volunteer on sorting night →
                </p>
              </div>
              <p className="font-display mt-4 font-semibold">Bright Pages</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                literacy nonprofit · signups + donations
              </p>
            </div>

            {/* --- Luz Candle Co: elegant small shop --- */}
            <div className="rounded-xl border border-line bg-paper p-4">
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
                <p className="px-4 pt-2 text-[8px]" style={{ color: "#8A7F6A" }}>
                  from $14 · order for pickup →
                </p>
              </div>
              <p className="font-display mt-4 font-semibold">Luz Candle Co.</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                small shop · product showcase + orders
              </p>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <p className="text-xs text-faint">
              Every one of these starts as a sentence and a vibe.
            </p>
            <Link
              href="/gallery"
              className="border-b-2 border-ink pb-1 text-sm font-medium transition hover:border-flame hover:text-flame"
            >
              see the live gallery →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Mission ---------- */}
      <section id="mission" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:flex sm:items-start sm:justify-between sm:gap-16">
          <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:max-w-xs">
            why lypo<span className="text-flame">?</span>
          </h2>
          <div className="mt-8 max-w-md sm:mt-0">
            <p className="leading-relaxed text-ink-soft">
              Good ideas die every day — not because they weren&apos;t good,
              but because someone couldn&apos;t afford a developer, never got
              taught to code, or was never told tech was for them. Lypo exists
              to tear that barrier down. We build for the organizers, students,
              hustlers, small nonprofits, and first-time builders in
              communities the digital world keeps leaving behind.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              If you can describe your idea, you can build it. That&apos;s the
              whole promise.
            </p>
            <Link
              href={user ? "/dashboard" : "/onboarding"}
              className="mt-8 inline-block border-b-2 border-ink pb-1 font-medium transition hover:border-flame hover:text-flame"
            >
              {user ? "go to my projects →" : "start building →"}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-faint">
          <span>no code · no gatekeeping</span>
          <span>lypo © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </main>
  );
}
