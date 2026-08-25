import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkCustomDomain } from "@/lib/links";
import {
  CUSTOM_DOMAINS_ENABLED,
  DNS_RECORDS,
  addDomain,
  domainStatus,
  removeDomain,
  verifyDomain,
} from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

async function ownedProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" as const, status: 401 };

  // RLS already scopes this, but checking the owner explicitly means a
  // mistake in a policy cannot quietly hand someone another site's domain.
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, slug, status, custom_domain")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.user_id !== user.id) {
    return { error: "Not found" as const, status: 404 };
  }

  // Connecting your own domain is self-serve, so this defaults to yes. The
  // column only exists so one site can be cut off for abuse; anything that
  // is not an explicit false is allowed, which also means a database without
  // the migration keeps working normally.
  let allowed = true;
  let desiredDomain: string | null = null;
  try {
    const { data } = await supabase
      .from("projects")
      .select("custom_domain_allowed, desired_domain")
      .eq("id", projectId)
      .maybeSingle();
    allowed = data?.custom_domain_allowed !== false;
    desiredDomain = (data?.desired_domain as string | null) ?? null;
  } catch {
    // Columns not there yet: everyone is allowed one, nobody is mid-purchase.
  }

  return { supabase, project, allowed, desiredDomain };
}

function unavailable() {
  return NextResponse.json(
    { error: "Custom domains are not switched on yet." },
    { status: 503 },
  );
}

/** Current state of this project's domain, for polling while DNS settles. */
export async function GET(request: Request) {
  if (!CUSTOM_DOMAINS_ENABLED) return unavailable();

  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const owned = await ownedProject(projectId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const domain = owned.project.custom_domain as string | null;
  if (!domain) {
    return NextResponse.json({
      domain: null,
      allowed: owned.allowed,
      desiredDomain: owned.desiredDomain,
    });
  }

  const status = await domainStatus(domain);
  return NextResponse.json({
    domain,
    allowed: owned.allowed,
    ...(status ?? { verified: false, misconfigured: true, verification: [] }),
    records: DNS_RECORDS,
    isApex: domain.split(".").length === 2,
  });
}

/** Attaches a domain to this project and to the Vercel project. */
export async function POST(request: Request) {
  if (!CUSTOM_DOMAINS_ENABLED) return unavailable();

  const { projectId, domain: raw, recheck } = await request.json();
  const owned = await ownedProject(String(projectId ?? ""));
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const { supabase, project, allowed } = owned;

  // Only reached for a site an admin has blocked. Hiding the controls in the
  // builder is a courtesy; this is what stops someone calling the endpoint
  // directly.
  if (!allowed) {
    return NextResponse.json(
      { error: "Custom domains are turned off for this site." },
      { status: 403 },
    );
  }

  // "Check again" on an already-attached domain, rather than a new one.
  if (recheck && project.custom_domain) {
    const verified = await verifyDomain(project.custom_domain as string);
    const status = await domainStatus(project.custom_domain as string);
    return NextResponse.json({
      domain: project.custom_domain,
      verified: verified || status?.verified === true,
      misconfigured: status?.misconfigured ?? true,
      verification: status?.verification ?? [],
      records: DNS_RECORDS,
      isApex: String(project.custom_domain).split(".").length === 2,
    });
  }

  const check = checkCustomDomain(String(raw ?? ""));
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  if (project.status !== "published") {
    return NextResponse.json(
      { error: "Publish the site first, then connect your domain to it." },
      { status: 400 },
    );
  }

  // Claim it in our own database first. The unique index is what actually
  // stops two sites taking one domain; doing this before calling Vercel
  // means a race loses here rather than half-way through provisioning.
  const { error: claimError } = await supabase
    .from("projects")
    .update({ custom_domain: check.domain })
    .eq("id", project.id);

  if (claimError) {
    return NextResponse.json(
      {
        error:
          claimError.code === "23505"
            ? "That domain is already connected to another Lypo site."
            : "Couldn't save that domain.",
      },
      { status: claimError.code === "23505" ? 409 : 500 },
    );
  }

  const added = await addDomain(check.domain);
  if (!added.ok) {
    // Release the claim, or a failed attempt would block them from trying
    // the same domain again once they have sorted it out on Vercel's side.
    await supabase
      .from("projects")
      .update({ custom_domain: null })
      .eq("id", project.id);
    return NextResponse.json(
      { error: added.error },
      { status: added.alreadyTaken ? 409 : 502 },
    );
  }

  // They have it now, so stop offering to help them buy it.
  await supabase
    .from("projects")
    .update({ desired_domain: null })
    .eq("id", project.id);

  return NextResponse.json({
    domain: check.domain,
    verified: added.verified,
    misconfigured: !added.verified,
    verification: added.verification,
    records: DNS_RECORDS,
    isApex: check.isApex,
  });
}

/** Disconnects the domain. The site stays live on its lypo.dev address. */
export async function DELETE(request: Request) {
  if (!CUSTOM_DOMAINS_ENABLED) return unavailable();

  const { projectId } = await request.json();
  const owned = await ownedProject(String(projectId ?? ""));
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const { supabase, project } = owned;
  const domain = project.custom_domain as string | null;

  if (domain) await removeDomain(domain);
  await supabase
    .from("projects")
    .update({ custom_domain: null })
    .eq("id", project.id);

  return NextResponse.json({ domain: null });
}
