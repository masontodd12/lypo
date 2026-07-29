# files changed.

9 new files, 7 modified. 454 lines added, 42 removed.

---

## new files

### `supabase-migration.sql` (81 lines)

Run this first, in the Supabase SQL editor. Creates:

- **`project_versions`** — id, project_id (cascade delete), page, html, summary, created_at. Indexed on (project_id, page, created_at desc). RLS: select/insert/delete all gated on a subquery confirming `projects.user_id = auth.uid()`, so one user can never touch another's history.
- **`site_views`** — composite primary key (project_id, day) with a count column. RLS select-only for owners.
- **`increment_site_view(pid uuid)`** — `security definer` function, granted to anon and authenticated. This is the important bit: public visitors bump the counter through the function, so the table itself never needs anon write access. An upsert on conflict, so it's one round trip per view.

### `lib/supabase/admin.ts` (11 lines)

Service-role Supabase client. Only the weekly cron imports it, because that job has to read across every user's projects, which RLS correctly forbids for a normal client. Never import this from a client component.

### `app/api/versions/route.ts` (108 lines)

- **GET** `?projectId=&page=` — returns the last 30 versions, id/summary/created_at only. Deliberately excludes html so the history list stays light.
- **POST** `{projectId, versionId}` — restores. Verifies ownership, writes the old html back into the pages map and the html column, then snapshots the restore itself so undo is undoable.

### `app/api/roast/route.ts` (98 lines)

Pre-publish critique. Its own system prompt tells the model to be a sharp friend: check whether the headline is specific, whether there's one clear ask above the fold on mobile, whether buttons name the real action, what's missing (price, date, address, phone), trust signals, alt text, anything template-y. Numbered worst-first, each point ending in a fix the user can paste into the chat. Roast the page, never the person. 10 per hour per user.

### `app/api/broadcast/route.ts` (119 lines)

Scans every form response for anything matching an email regex, dedupes, caps at 200. Sends one request per recipient so nobody sees anyone else's address. Reply-to is the site owner, so replies go to a human. HTML-escapes the body. Rate limited to 3 sends per site per day, which is enough for real updates and hostile to spam.

### `app/api/cron/weekly/route.ts` (104 lines)

Monday 14:00 UTC. Guarded by `CRON_SECRET` in the Authorization header, since it sends email. Pulls published projects with an owner email, sums the last 7 days of views and responses, groups by owner (so one email covers all their sites), and skips anyone with a fully dead week so it never becomes noise.

### `components/BroadcastForm.tsx` (117 lines)

The "message my supporters (N)" UI on the responses page. Collapsed by default, confirms before sending, shows sent/total on success. Hides itself entirely when no email addresses exist yet.

### `vercel.json` (8 lines)

Cron entry: `/api/cron/weekly` on `0 14 * * 1`. Vercel sends the CRON_SECRET header automatically.

### `SETUP-NEW-FEATURES.md` (72 lines)

The three setup steps and a plain-language description of everything that shipped.

---

## modified files

### `app/api/generate/route.ts` (+134)

The big one. Entire SYSTEM_PROMPT rewritten:

- **FORBIDDEN block** — gradient backgrounds, gradient buttons, neon/electric accents, more than one accent color, glow effects, default dark mode, viewport-filling headlines, Inter/Poppins/Montserrat as display faces, ALL CAPS, the three-across icon grid, emoji, em dashes, filler copy, generic image captions, invented numbers, stock CTA labels.
- **REQUIRED block** — semantic HTML, one h1, real alt text, 4.5:1 contrast, focus-visible outlines, 44px tap targets, mobile-first with no 320px scroll, CSS custom properties, full Open Graph and Twitter tags.
- **DESIGN APPROACH** — how to derive a palette from the subject and uploaded photos, font pairing directions, space over decoration, photo-as-hero, write copy like a person, never include a block with no content.
- **`PURPOSES` map** — 13 purpose blocks (fundraiser, memorial, church, barbershop, foodtruck, sports, business, event, portfolio, personal, landing, shop, community), each listing the sections that kind of site actually needs.
- **Version snapshotting** — after each successful save, inserts into `project_versions` and prunes past 30 per page. Wrapped in try/catch so it can't break generation if the migration hasn't run.

### `components/BuilderChat.tsx` (+267)

- `SITE_TYPES` rewritten from generic categories to the 12 purpose modes, sent to the API as `purpose` on every call, not just the first build.
- `STYLES` prompts rewritten to stop asking for the exact things the new prompt forbids. The old `dark` style literally requested "one glowing accent color"; `playful` requested purple-plus-pink. Both fixed.
- New state and handlers: `openHistory`, `restoreVersion`, `roast`, `downloadHtml`, device toggle.
- New chips: history, roast it, en/español.
- History panel with timestamps and per-version restore.
- Preview toolbar: desktop/phone toggle (390px framed iframe) and download code.

### `app/s/[slug]/page.tsx` (+50)

- `extractMeta()` pulls the description and first image out of the generated HTML. Needed because the site renders inside an iframe, so its own head tags are invisible to link unfurlers.
- `generateMetadata` now emits real description, Open Graph, and Twitter card tags. This is what fixes broken previews when someone texts their link.
- View counter fires on render, wrapped so it can never block the page.

### `app/s/[slug]/[page]/page.tsx` (+8)

Same view counter on multi-page subpages.

### `app/dashboard/page.tsx` (+14)

Fetches view totals for all the user's projects in one query, passes counts into each card.

### `components/ProjectCard.tsx` (+7)

Optional `views` prop, rendered next to the status line on published sites only.

### `app/builder/[id]/responses/page.tsx` (+16)

Counts unique email addresses across responses and mounts `BroadcastForm`.

---

## verification

- `tsc --noEmit` clean
- `eslint` on all 16 touched files: 2 errors, both pre-existing `Date.now()` purity warnings in the build-timer code that predate this work
- All 12 client purpose ids resolve to a server-side block
- Zero em dashes in any new file
