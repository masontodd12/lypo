/**
 * Checking a link an owner pasted before it goes on their public site.
 *
 * Covers ordering links and booking links alike: the risk is identical
 * either way, since both end up as a button a customer taps.
 *
 * What this can do: reject anything that is not a plain web address, catch
 * typos and pasted nonsense, and recognise the ordering services people
 * actually use so an unfamiliar domain gets a second look.
 *
 * What it cannot do: tell you whether a real, well-formed site is a scam.
 * Nothing short of a reputation service can, and pretending otherwise would
 * be worse than being clear about it. The goal here is to make the obvious
 * failures impossible and the unusual ones visible.
 */

/** Ordering, booking and reservation services these owners genuinely use. */
const KNOWN_PROVIDERS = [
  // Booking and appointments
  "booksy.com",
  "vagaro.com",
  "styleseat.com",
  "squire.co",
  "getsquire.com",
  "fresha.com",
  "glossgenius.com",
  "schedulicity.com",
  "setmore.com",
  "calendly.com",
  "acuityscheduling.com",
  "app.acuityscheduling.com",
  "mindbodyonline.com",
  "boulevard.io",
  "joinblvd.com",
  "housecallpro.com",
  "getjobber.com",
  "square.site",
  "squareup.com",
  "book.squareup.com",
  // Ordering and delivery
  "toasttab.com",
  "order.online", // Toast's short domain
  "clover.com",
  "doordash.com",
  "ubereats.com",
  "grubhub.com",
  "seamless.com",
  "chownow.com",
  "olo.com",
  "popmenu.com",
  "spoton.com",
  "slicelife.com",
  "menufy.com",
  "toasttab.co",
  "opentable.com",
  "resy.com",
  "ezcater.com",
];

/** Schemes that execute rather than navigate. Never allowed in an href. */
const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript|file|blob):/i;

export type LinkCheck =
  | {
      ok: true;
      /** Normalised, safe to put in an href. */
      url: string;
      host: string;
      /** A recognised ordering service, so almost certainly what they meant. */
      known: boolean;
    }
  | { ok: false; reason: string };

export function checkExternalLink(raw: string): LinkCheck {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "Nothing entered." };

  if (DANGEROUS_SCHEME.test(trimmed)) {
    return {
      ok: false,
      reason: "That is not a web address. Links must start with https://",
    };
  }

  // People paste "order.toasttab.com/..." without a scheme far more often
  // than they mean a relative path.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "That does not look like a web address." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: "Links must start with https://",
    };
  }

  const host = parsed.hostname.toLowerCase();

  // A hostname with no dot is a typo or an internal name, never a public
  // ordering page.
  if (!host.includes(".")) {
    return { ok: false, reason: "That address is missing a domain, like .com" };
  }

  // Bare IPs are never a real ordering page and are a common phishing shape.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    return { ok: false, reason: "That is an IP address, not a website." };
  }

  // Nothing local should ever be published as a customer-facing link.
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: "That address only works on your own device." };
  }

  // Mixed scripts in a domain are the homograph trick: a Cyrillic "а" in
  // what looks like toasttab.com. Punycode is how it reaches the browser.
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    return {
      ok: false,
      reason:
        "That domain uses lookalike characters. Type the address by hand to be sure.",
    };
  }

  const known = KNOWN_PROVIDERS.some(
    (p) => host === p || host.endsWith(`.${p}`),
  );

  // Upgrade bare http to https. Ordering pages all support it, and sending
  // customers somewhere insecure to type a card number is not acceptable.
  parsed.protocol = "https:";

  return { ok: true, url: parsed.toString(), host, known };
}

/**
 * Strips link destinations that execute instead of navigating.
 *
 * A generated page is arbitrary HTML written by a model, and a javascript:
 * href inside it runs with the published site's own origin. This is a
 * backstop: the prompt forbids invented links, but a rule in a prompt is not
 * a guarantee and this is cheap to enforce for real.
 */
export function stripDangerousHrefs(html: string): {
  html: string;
  removed: number;
} {
  let removed = 0;
  const cleaned = html.replace(
    /(<a\b[^>]*?\shref\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (match, prefix: string, _quoted: string, dq?: string, sq?: string) => {
      const value = dq ?? sq ?? "";
      if (!DANGEROUS_SCHEME.test(value)) return match;
      removed += 1;
      return `${prefix}"#"`;
    },
  );
  return { html: cleaned, removed };
}

/** Hosts nobody can claim as their own site. */
const NEVER_ALLOWED = [
  "lypo.dev",
  "vercel.app",
  "vercel.com",
  "vercel-dns.com",
  "supabase.co",
  "localhost",
];

export type DomainCheck =
  | { ok: true; domain: string; isApex: boolean }
  | { ok: false; reason: string };

/**
 * Checks a domain an owner wants to point at their site.
 *
 * Stricter than checkExternalLink: this is not a link to somewhere else, it
 * is an address we will be asked to serve and issue a certificate for, so a
 * path or a port is a sign they pasted the wrong thing.
 */
export function checkCustomDomain(raw: string): DomainCheck {
  let value = (raw ?? "").trim().toLowerCase();
  if (!value) return { ok: false, reason: "Nothing entered." };

  if (DANGEROUS_SCHEME.test(value)) {
    return { ok: false, reason: "That is not a domain." };
  }

  // People paste the whole address out of the address bar.
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (value.includes("@")) {
    return { ok: false, reason: "That looks like an email address." };
  }
  if (value.includes(":")) {
    return { ok: false, reason: "Leave the port off, just the domain." };
  }
  if (!value.includes(".")) {
    return { ok: false, reason: "That is missing a domain ending, like .com" };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return { ok: false, reason: "That is an IP address, not a domain." };
  }
  if (value.startsWith("xn--") || value.includes(".xn--")) {
    return {
      ok: false,
      reason: "That domain uses lookalike characters. Type it by hand to be sure.",
    };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    return { ok: false, reason: "That does not look like a domain." };
  }
  if (value.length > 253) {
    return { ok: false, reason: "That domain is too long." };
  }
  if (NEVER_ALLOWED.some((h) => value === h || value.endsWith(`.${h}`))) {
    return {
      ok: false,
      reason: "That address belongs to Lypo. Use a domain you own.",
    };
  }

  // Two labels means an apex like example.com, which needs an A record.
  // More means a subdomain like shop.example.com, which needs a CNAME.
  const isApex = value.split(".").length === 2;
  return { ok: true, domain: value, isApex };
}

/**
 * Removes layout declarations from :root and html blocks.
 *
 * A real observed failure: a generated page declared "max-width: 980px"
 * inside the :root block, in among the custom properties. :root is html, so
 * that clamped the whole document to 980px pinned to the left of the screen
 * with the rest of the window empty. The intent was a --max-width token,
 * dropping the leading dashes turned it into a page-breaking rule.
 *
 * Deliberately narrow: only width and max-width, only on :root and html, and
 * never touching custom properties, which are the whole point of that block.
 */
export function stripRootLayout(html: string): {
  html: string;
  removed: number;
} {
  let removed = 0;
  const cleaned = html.replace(
    /(^|[},{;\s])((?::root|html)[^{}]{0,40})\{([^{}]*)\}/g,
    (match, lead: string, selector: string, block: string) => {
      const next = block.replace(
        // A width or max-width that is not a custom property.
        /(^|;)\s*(max-width|width)\s*:[^;}]*/gi,
        (decl, sep: string) => {
          // "--max-width: 980px" must survive; only the bare property goes.
          if (/(^|;)\s*--/.test(decl)) return decl;
          removed += 1;
          return sep;
        },
      );
      return `${lead}${selector}{${next}}`;
    },
  );
  return { html: cleaned, removed };
}
