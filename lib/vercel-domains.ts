/**
 * Attaching a customer's own domain to the Vercel project that serves Lypo.
 *
 * Vercel will not issue a TLS certificate for a domain it does not know
 * about, so pointing DNS at us is not enough on its own: the domain has to
 * be registered against the project through this API first.
 */

const API = "https://api.vercel.com";

/** Project name or id in Vercel. */
const PROJECT = process.env.VERCEL_PROJECT_ID ?? "lypo";
/** Only needed on a team account; a personal account leaves this unset. */
const TEAM = process.env.VERCEL_TEAM_ID ?? "";
const TOKEN = process.env.VERCEL_TOKEN ?? "";

/** Whether the feature can work at all. */
export const CUSTOM_DOMAINS_ENABLED = !!TOKEN;

/**
 * The records a customer adds at their registrar.
 *
 * Configurable because Vercel issues a per-project CNAME target now, of the
 * shape d1d4fc829fe7bc7c.vercel-dns-017.com, so a hardcoded value would send
 * everyone somewhere wrong. Read yours once from the Vercel dashboard by
 * starting to add any domain, then set these.
 */
// || rather than ??, because a variable created in the dashboard with no
// value is an empty string, not undefined. ?? let that through and showed a
// customer a blank record to copy, which is worse than showing the default.
const apexA = process.env.VERCEL_DNS_A?.trim() || "";
const cname = process.env.VERCEL_DNS_CNAME?.trim() || "";

export const DNS_RECORDS = {
  apexARecord: apexA || "76.76.21.21",
  cnameTarget: cname || "cname.vercel-dns.com",
  /** Both set to something real, so the values shown are this project's. */
  configured: !!apexA && !!cname,
};

function qs() {
  return TEAM ? `?teamId=${encodeURIComponent(TEAM)}` : "";
}

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // Some deletes come back empty, which is fine.
  }
  return { ok: res.ok, status: res.status, body };
}

export type VerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type AddDomainResult =
  | { ok: true; verified: boolean; verification: VerificationRecord[] }
  | { ok: false; error: string; alreadyTaken?: boolean };

/** Vercel's own message is more useful than anything generic we would write. */
function messageFrom(body: Record<string, unknown>, fallback: string): string {
  const err = body?.error as { message?: string } | undefined;
  return err?.message ?? fallback;
}

export async function addDomain(domain: string): Promise<AddDomainResult> {
  const { ok, status, body } = await call(
    `/v10/projects/${encodeURIComponent(PROJECT)}/domains${qs()}`,
    { method: "POST", body: JSON.stringify({ name: domain }) },
  );

  if (!ok) {
    // 409 means someone else's Vercel account holds it. That is a different
    // problem from a typo and deserves a different explanation.
    if (status === 409) {
      return {
        ok: false,
        alreadyTaken: true,
        error: messageFrom(
          body,
          "That domain is already connected to another Vercel account.",
        ),
      };
    }
    return { ok: false, error: messageFrom(body, "Vercel refused that domain.") };
  }

  return {
    ok: true,
    verified: body.verified === true,
    verification: (body.verification as VerificationRecord[]) ?? [],
  };
}

export type DomainStatus = {
  /** Vercel accepts that the owner controls this domain. */
  verified: boolean;
  /** DNS is not yet pointing here. Usually just propagation. */
  misconfigured: boolean;
  verification: VerificationRecord[];
};

export async function domainStatus(domain: string): Promise<DomainStatus | null> {
  const [project, config] = await Promise.all([
    call(`/v9/projects/${encodeURIComponent(PROJECT)}/domains/${encodeURIComponent(domain)}${qs()}`),
    call(`/v6/domains/${encodeURIComponent(domain)}/config${qs()}`),
  ]);
  if (!project.ok) return null;

  return {
    verified: project.body.verified === true,
    misconfigured: config.body?.misconfigured === true,
    verification: (project.body.verification as VerificationRecord[]) ?? [],
  };
}

/** Asks Vercel to re-check the challenge now rather than on its own schedule. */
export async function verifyDomain(domain: string): Promise<boolean> {
  const { ok, body } = await call(
    `/v9/projects/${encodeURIComponent(PROJECT)}/domains/${encodeURIComponent(domain)}/verify${qs()}`,
    { method: "POST" },
  );
  return ok && body.verified === true;
}

/**
 * Detaches the domain from the project.
 *
 * Only removed from the project, never from the Vercel account, so a domain
 * someone actually bought through Vercel is not deleted by disconnecting it
 * from a site.
 */
export async function removeDomain(domain: string): Promise<boolean> {
  const { ok } = await call(
    `/v9/projects/${encodeURIComponent(PROJECT)}/domains/${encodeURIComponent(domain)}${qs()}`,
    { method: "DELETE" },
  );
  return ok;
}

export type DomainOffer = {
  domain: string;
  /** null when the lookup itself failed, which is not the same as "taken". */
  available: boolean | null;
  /** Yearly price in whole currency units, when Vercel will quote one. */
  price: number | null;
};

export type OfferResult =
  | { ok: true; offer: DomainOffer }
  | { ok: false; status: number; message: string };

/**
 * Whether a domain can still be registered, and roughly what it costs.
 *
 * Only ever used to help someone who does not own a domain yet decide what
 * to go and buy. Lypo does not sell domains and takes no money, so this is a
 * lookup and nothing more.
 *
 * Reports why it failed rather than returning nothing. These endpoints are
 * account-level, so a project-scoped token gets a 403 that looks identical
 * to a rate limit if the reason is thrown away, and neither is guessable
 * from "could not check that one".
 *
 * Price is best-effort: Vercel does not quote every extension, and the ones
 * it does quote run higher than most registrars. A null means "we could not
 * find out", never "free".
 */
export async function domainOffer(domain: string): Promise<OfferResult> {
  const team = TEAM ? `&teamId=${encodeURIComponent(TEAM)}` : "";
  const status = await call(
    `/v4/domains/status?name=${encodeURIComponent(domain)}${team}`,
  );
  if (!status.ok) {
    const message = messageFrom(status.body, "Vercel would not answer.");
    console.error(
      `domain status lookup failed for ${domain}: ${status.status} ${message}`,
    );
    return { ok: false, status: status.status, message };
  }

  const available = status.body.available === true;
  if (!available) {
    return { ok: true, offer: { domain, available: false, price: null } };
  }

  // Asked for separately, and allowed to fail on its own: knowing a name is
  // free is the useful half, and losing it because a price lookup 404'd
  // would be a poor trade.
  const priced = await call(
    `/v4/domains/price?name=${encodeURIComponent(domain)}${team}`,
  );
  const price =
    priced.ok && typeof priced.body.price === "number"
      ? priced.body.price
      : null;

  return { ok: true, offer: { domain, available: true, price } };
}

/**
 * Alternatives to offer when the name someone wanted is gone.
 *
 * Same second-level name on other endings rather than clever variations on
 * the name itself: someone who typed "joesbarbershop" wants that name, and
 * "joesbarbershopofficial" is the kind of suggestion that makes a business
 * look like it could not get its own name.
 */
export function alternativesFor(domain: string): string[] {
  const base = domain.split(".")[0];
  return ["com", "co", "net", "shop", "studio", "cafe"]
    .map((tld) => `${base}.${tld}`)
    .filter((d) => d !== domain);
}
