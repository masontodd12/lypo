# subdomains.

Published sites now live at `masonfundraiser.lypo.dev` instead of `lypo.dev/s/masonfundraiser`.

The old `/s/<slug>` path keeps working forever, so every link anyone already shared, texted, or printed on a poster still resolves. It is just no longer the address shown in the UI.

---

## the DNS part (you have to do this)

The code is done, but subdomains cannot work until wildcard DNS exists. **Vercel requires wildcard domains to use Vercel's nameservers.** There is a workaround for wildcards on a subdomain, but not for an apex wildcard like `*.lypo.dev`, so moving nameservers is the only path here.

That means moving `lypo.dev` DNS from Namecheap to Vercel.

### steps

1. **Vercel** → your project → Settings → Domains → Add → enter `*.lypo.dev`
2. Vercel will enable Vercel DNS automatically and show you two nameservers, something like `ns1.vercel-dns.com` and `ns2.vercel-dns.com`
3. **Namecheap** → Domain List → `lypo.dev` → Manage → Nameservers → switch from "Namecheap BasicDNS" to "Custom DNS" → paste both Vercel nameservers → save
4. Wait for propagation. Usually under an hour, occasionally up to 48.
5. Back in Vercel, confirm both `lypo.dev` and `*.lypo.dev` show as Valid

### before you switch, copy your existing records

Switching nameservers moves **all** DNS for the domain to Vercel. Anything currently set at Namecheap stops existing unless you recreate it in Vercel DNS.

Go to Namecheap → Advanced DNS and write down every record before you touch anything. Watch for:

- **MX records** if you receive email at an @lypo.dev address
- **TXT records** for domain verification (Google, Stripe, anything else)
- **SPF / DKIM** records if you ever set up a sending domain

Good news on email: you currently send from `notifications@resend.dev`, which is Resend's shared domain, so you probably have no email DNS to migrate. Worth confirming rather than assuming. If you later want to send from `hello@lypo.dev`, you will add Resend's records in Vercel DNS instead of Namecheap.

### verify it worked

```
dig anything.lypo.dev
```

Should resolve to Vercel. Then publish a site and open its subdomain. SSL certificates are issued per-subdomain automatically, on the fly, so there is nothing to configure there.

---

## what changed in the code

**`middleware.ts`** — Note: your middleware file was previously named `middleware.ts ` with a trailing space, which meant Next.js never loaded it. Custom domain routing and middleware session refresh had never actually run. Renamed correctly and now handles:

- `<slug>.lypo.dev` rewrites to `/s/<slug>`, and `<slug>.lypo.dev/about` to `/s/<slug>/about`
- Reserved subdomains (`www`, `api`, `app`, `dashboard`, and ~20 more) are excluded, so they can never be captured by a user's site
- Only single-label subdomains match, so `a.b.lypo.dev` is not treated as a slug
- `/api/*`, `/_next/*`, `/sw.js`, and `/favicon.ico` are excluded from rewriting on every host. Without this, form submissions and Stripe checkout calls from a subdomain would have been rewritten into the site path and broken.
- Custom domain handling preserved

**`lib/site-url.ts`** — new. Single source of truth for public URLs. `siteUrlFor(slug)` returns `https://slug.lypo.dev` in production and falls back to `/s/slug` on localhost and `.vercel.app` previews, where wildcard DNS does not exist. Also exports `RESERVED_SUBDOMAINS`.

**`app/api/publish/route.ts`** — rejects reserved names at publish time, since a slug is now a subdomain.

**`components/PublishButton.tsx`** — the picker now reads `yourname` + `.lypo.dev` instead of `/s/` + `yourname`. Copy link and view live use the subdomain.

**`app/s/[slug]/page.tsx` and `[page]/page.tsx`** — multi-page nav is host-aware. On a subdomain, links go to `/about`; on the main domain, `/s/slug/about`. Form and storage endpoints are absolute to the main origin, which the existing CORS headers already allow. Stripe checkout is now called at an absolute URL rather than `location.origin`.

**`app/poster/[slug]/page.tsx`** — QR codes encode the subdomain URL.

**Note on existing posters:** any QR code printed before this deploy still encodes the old `/s/` URL, which still works. Nothing already in the world breaks.

**`app/api/manifest/[id]/route.ts`** — `start_url` and `scope` are now relative (`.`), so an installed PWA stays on whichever host it was added from.

**`app/api/stripe/checkout/route.ts`**, **`broadcast`**, **`cron/weekly`** — all use `siteUrlFor()`.

---

## verified

- `tsc --noEmit` clean
- `eslint` clean on all 12 touched files
- Path routing preserved for localhost and preview deploys, so `npm run dev` behaves exactly as before

## worth knowing

Until you switch nameservers, everything still works at `lypo.dev/s/<slug>`, but the UI will show and copy `<slug>.lypo.dev` URLs that do not resolve yet. So either do the DNS switch soon after deploying, or hold this commit until you are ready.
