import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkCustomDomain } from "@/lib/links";
import {
  CUSTOM_DOMAINS_ENABLED,
  alternativesFor,
  domainOffer,
} from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

/**
 * Looks up whether a domain is still free, for someone who does not own one.
 *
 * Lypo does not sell domains and never handles the money: this exists so a
 * barbershop owner finds out that the .com is gone before driving off to a
 * registrar, not so we can take a cut. The buying happens elsewhere; all we
 * keep is which name they went to get, so connecting it later is one tap.
 */
export async function GET(request: Request) {
  if (!CUSTOM_DOMAINS_ENABLED) {
    return NextResponse.json({ error: "Not switched on." }, { status: 503 });
  }

  // Signed in only. It is a small lookup, but an open one would make this an
  // anonymous proxy onto our Vercel token's rate limit.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  // Someone searching for a name types "joesbarbershop", not a whole domain,
  // so a bare word becomes a .com rather than an error about a missing dot.
  const guess = raw.trim().toLowerCase();
  const withTld = guess.includes(".") ? guess : `${guess}.com`;

  const check = checkCustomDomain(withTld);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const result = await domainOffer(check.domain);

  // A failed lookup must not kill the feature. Knowing whether a name is
  // free is the nice half; the useful half is sending someone somewhere they
  // can buy it, and that works whether or not Vercel answered. So the domain
  // still comes back, marked unchecked, with somewhere to go.
  if (!result.ok) {
    return NextResponse.json({
      offer: { domain: check.domain, available: null, price: null },
      alternatives: [],
      unchecked: true,
      reason:
        result.status === 403
          ? "Availability checking is not enabled for this Vercel token."
          : result.message,
    });
  }

  const offer = result.offer;

  // Alternatives are only worth fetching when the first choice is gone.
  // Checked together rather than in turn, because six lookups one after
  // another is most of a second of someone watching a spinner.
  const alternatives =
    offer.available === false
      ? (await Promise.all(alternativesFor(check.domain).map(domainOffer)))
          .filter((r) => r.ok && r.offer.available === true)
          .map((r) => (r as { ok: true; offer: typeof offer }).offer)
          .slice(0, 4)
      : [];

  return NextResponse.json({ offer, alternatives });
}

/**
 * Remembers the domain someone left to go and buy.
 *
 * We cannot watch their registrar, so this is what makes the return trip
 * work: they come back, possibly on another day, and the panel already knows
 * which name they were after instead of asking them to remember it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, domain } = await request.json();
  const wanted = domain === null ? null : checkCustomDomain(String(domain ?? ""));
  if (wanted !== null && !wanted.ok) {
    return NextResponse.json({ error: wanted.reason }, { status: 400 });
  }

  const { error } = await supabase
    .from("projects")
    .update({ desired_domain: wanted === null ? null : wanted.domain })
    .eq("id", String(projectId ?? ""));

  // Not worth failing the flow over. They can still type the domain in by
  // hand when they get back; this only saves them the trouble.
  if (error) console.warn("could not save desired_domain:", error.message);

  return NextResponse.json({ ok: true });
}
