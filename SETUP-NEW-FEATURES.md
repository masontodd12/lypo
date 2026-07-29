# setup: new features.

Three things to do before this all works in production.

## 1. Run the migration

Open the Supabase SQL editor and run `supabase-migration.sql`. It creates:

- `project_versions` (version history, RLS scoped to the project owner)
- `site_views` + the `increment_site_view()` function (analytics, security definer so public sites can bump the counter without any anon write access)

Everything is written to fail soft. If you deploy the code before running the migration, generation and published sites still work, they just skip snapshots and view counts.

## 2. Add two env vars

```
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase dashboard, Settings, API. Server only, never expose.
CRON_SECRET=...                 # any long random string
```

`SUPABASE_SERVICE_ROLE_KEY` is only used by the weekly cron, which needs to read across all users. `CRON_SECRET` is what guards that endpoint, since it sends email.

## 3. Deploy

`vercel.json` adds the cron entry (Mondays 14:00 UTC, so roughly 9am Central). Vercel picks it up on deploy and sends the `Authorization: Bearer $CRON_SECRET` header automatically.

---

## what shipped

**New generation prompt** (`app/api/generate/route.ts`)
Hard FORBIDDEN section covering the AI-slop tells: gradient backgrounds and buttons, neon and electric accents, more than one accent color, glow effects, default dark mode, viewport-filling headlines, Inter/Poppins/Montserrat as display faces, the three-across icon grid, emoji, em dashes, filler copy, generic image captions, invented numbers, stock CTA labels. Then wide latitude on palette and type, derived from the subject and any uploaded photos. Also now requires semantic HTML, real alt text, 4.5:1 contrast, focus outlines, 44px tap targets, mobile-first CSS, and full Open Graph tags.

**Purpose modes**
The site-type picker is now purpose-driven: fundraiser, memorial, church, barbershop/salon, food truck, youth sports, small business, event, portfolio, community group, idea launch, shop. Each maps to a server-side block listing the sections that kind of site actually needs. The chosen purpose rides along on every subsequent edit, not just the first build.

**Version history**
Every generation snapshots to `project_versions` (30 kept per page, older ones pruned). The builder has a `history` chip that lists changes with timestamps and a restore button. Restoring is itself snapshotted, so undo is undoable.

**Analytics**
`/s/[slug]` and its subpages bump a per-day counter. View totals show on dashboard cards under published sites.

**Link previews**
The generated site lives in an iframe, so its own meta tags were invisible to unfurlers. `generateMetadata` now extracts the description and first image out of the HTML and emits real Open Graph and Twitter card tags on the wrapper page. Texted links will preview properly.

**Mobile preview + code download**
Device toggle in the preview toolbar (390px phone frame) and a `download code` button that saves the current page as a standalone `.html`.

**Message my supporters** (`/api/broadcast`)
Finds every email address across a project's form responses and sends an update to each one individually, so recipients never see each other. Reply-to is set to the site owner. Capped at 200 recipients and 3 sends per site per day.

**Roast mode** (`/api/roast`)
Honest pre-publish critique: vague headline, unclear ask, buried CTA, missing price/date/address, missing alt text, template-y feel. Numbered worst-first, each point ending in a fix the user can paste straight into the builder. 10 per hour per user.

**Weekly stats email** (`/api/cron/weekly`)
Monday morning digest per owner: views and responses for each published site over the last 7 days. Skips owners with a fully dead week so it never becomes noise.

**Bilingual toggle**
A chip that rewrites the site as English/Spanish with a working EN/ES switcher, design preserved.

---

## verified

- `tsc --noEmit` passes clean
- `eslint` on all touched files: only 2 errors, both pre-existing `Date.now()` purity warnings in the build-timer code that predate these changes
- All 12 purpose-mode ids in the client resolve to a server-side block
- Zero em dashes in any new file

## not built yet

From the roadmap, still open: Cash App/Venmo rails (needs your call on the business model), text-to-site and call-to-build (Twilio, a quarter of work), gallery forking, print pack, handoff and collaboration, fundraiser verification, "make mine look like that". GitHub two-way sync is also still open; `download code` is the cheap 80% of it.
