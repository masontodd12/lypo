import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

async function getProject(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("html, name, pages, slug, project_id:id")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();
  return data;
}

// The generated site renders inside an iframe, so its own <head> tags are
// invisible to link unfurlers. Pull description + image out of the HTML and
// surface them on the wrapper page so texted links preview properly.
function extractMeta(html: string | null | undefined) {
  if (!html) return { description: null, image: null };
  const description =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    )?.[1] ??
    null;
  const image =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    )?.[1] ??
    html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)?.[1] ??
    null;
  return { description, image };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  const pagesMap = (project?.pages ?? null) as Record<string, string> | null;
  const { description, image } = extractMeta(
    pagesMap?.home ?? project?.html,
  );
  const title = project?.name ?? "Lypo site";
  return {
    title,
    description: description ?? undefined,
    manifest: project ? `/api/manifest/${project.project_id}` : undefined,
    themeColor: "#e8542f",
    openGraph: {
      title,
      description: description ?? undefined,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: description ?? undefined,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicSite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProject(slug);
  const pagesMap = (project?.pages ?? null) as Record<string, string> | null;
  const pageHtml = pagesMap?.home ?? project?.html;
  if (!project || !pageHtml) notFound();

  // Count the view (best-effort, never blocks the render)
  try {
    const supabase = await createClient();
    await supabase.rpc("increment_site_view", { pid: project.project_id });
  } catch {
    // analytics table not migrated yet; the site still renders
  }

  const site = appOrigin();

  // Multi-page nav has to know where it lives. On my-site.lypo.dev the pages
  // are at "/about"; on lypo.dev they're at "/s/my-site/about".
  const requestHost = ((await headers()).get("host") ?? "").toLowerCase();
  const navBase = requestHost.startsWith(`${project.slug}.`)
    ? ""
    : `/s/${project.slug ?? ""}`;

  const injected = `
<script>
(function () {
  var LYPO_PROJECT_ID = ${JSON.stringify(project.project_id)};
  var LYPO_SUBMIT = ${JSON.stringify(site + "/api/submit")};
  var LYPO_STORE = ${JSON.stringify(site + "/api/store")};

  // ---------- lypo.storage: persistence for web apps ----------
  window.lypo = {
    save: function (key, value) {
      return fetch(LYPO_STORE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: LYPO_PROJECT_ID, action: "set", key: key, value: value })
      }).then(function (r) { return r.json(); });
    },
    load: function (key) {
      return fetch(LYPO_STORE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: LYPO_PROJECT_ID, action: "get", key: key })
      }).then(function (r) { return r.json(); }).then(function (d) { return d.value; });
    }
  };

  // ---------- multi-page nav ----------
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-lypo-page]");
    if (!link) return;
    e.preventDefault();
    var page = link.getAttribute("data-lypo-page");
    if (!page) return;
    var base = ${JSON.stringify(navBase)};
    window.top.location.href = page === "home" ? (base || "/") : base + "/" + page;
  }, true);

  // ---------- form capture ----------
  var typed = {};
  function keyFor(el) {
    return el.name || el.id || el.getAttribute("placeholder") || "";
  }
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== "input" && tag !== "select" && tag !== "textarea") return;
    var key = keyFor(el);
    if (!key) return;
    if (el.type === "checkbox") {
      var group = document.querySelectorAll('input[type=checkbox][name="' + el.name + '"]');
      var vals = [];
      group.forEach(function (c) { if (c.checked) vals.push(c.value || "yes"); });
      typed[key] = vals.join(", ");
    } else if (el.type === "radio") {
      if (el.checked) typed[key] = el.value;
    } else {
      typed[key] = el.value;
    }
  }, true);
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el && (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "radio")) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, true);

  function collect(scope) {
    var data = {};
    scope.querySelectorAll("input, select, textarea").forEach(function (el) {
      var key = keyFor(el);
      if (!key || el.type === "submit" || el.type === "button") return;
      var value = "";
      if (el.type === "checkbox") { if (el.checked) value = el.value || "yes"; }
      else if (el.type === "radio") { if (el.checked) value = el.value; }
      else { value = el.value || ""; }
      if (value !== "" || !(key in data)) data[key] = value;
    });
    Object.keys(typed).forEach(function (key) {
      if (typed[key] !== "" && (!data[key] || data[key] === "")) data[key] = typed[key];
    });
    return data;
  }

  // Inherits the page's own font and colors so it reads as part of the
  // site rather than a browser dialog.
  function notice(message, tone) {
    var bar = document.createElement("div");
    bar.setAttribute("role", "status");
    bar.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;" +
      "max-width:min(30rem,calc(100vw - 2rem));padding:0.85rem 1.25rem;border-radius:10px;" +
      "font:inherit;font-size:0.95rem;line-height:1.4;text-align:center;color:#fff;" +
      "box-shadow:0 8px 30px rgba(0,0,0,0.18);background:" +
      (tone === "error" ? "#B3341A" : "#1F7A4D") + ";";
    bar.textContent = message;
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 6000);
  }

  function send(scope, resetTarget) {
    var THANKS = "Thanks, your response was received.";
    fetch(LYPO_SUBMIT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: LYPO_PROJECT_ID, data: collect(scope) })
    }).then(function (r) {
      // A non-2xx means it was NOT stored. Never tell someone their
      // signup went through when it did not.
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          notice(data.error || "That did not send. Please try again.", "error");
        });
      }
      if (resetTarget) {
        resetTarget.innerHTML =
          '<p style="padding:1.5rem;text-align:center;font-size:1.1rem;">' + THANKS + '</p>';
      } else {
        notice(THANKS);
      }
    }).catch(function () {
      notice("Something went wrong sending your response. Please try again.", "error");
    });
  }

  document.addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    var hasFields = form.querySelector && form.querySelector("input, select, textarea");
    send(hasFields ? form : document, form);
  });
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button, input[type=submit], a");
    if (!btn || btn.closest("form")) return;
    var label = (btn.textContent || btn.value || "").toLowerCase();
    if (/sign up|join|submit|send|register|volunteer|rsvp|subscribe/.test(label)) {
      e.preventDefault();
      send(document, null);
    }
  });

  // ---------- payments: only fire on .lypo-pay buttons ----------
  document.addEventListener("click", function (e) {
    var payBtn = e.target.closest && e.target.closest(".lypo-pay");
    if (!payBtn) return;
    e.preventDefault();
    var amount = parseInt(payBtn.getAttribute("data-amount") || "0", 10);
    var label = payBtn.getAttribute("data-label") || payBtn.textContent || "Payment";
    if (!amount || amount < 100) {
      notice("Payment amount is missing or too small.", "error");
      return;
    }
    payBtn.disabled = true;
    var originalText = payBtn.textContent;
    payBtn.textContent = "opening checkout…";
    fetch(${JSON.stringify(site + "/api/stripe/checkout")}, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: LYPO_PROJECT_ID, amount: amount, label: label })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.url) {
        window.location.href = data.url;
      } else {
        payBtn.disabled = false;
        payBtn.textContent = originalText;
        notice(data.error || "Payments aren't available for this site yet.", "error");
      }
    }).catch(function () {
      payBtn.disabled = false;
      payBtn.textContent = originalText;
      notice("Couldn't reach the payment server.", "error");
    });
  });
})();
</script>
<div style="position:fixed;bottom:10px;right:10px;z-index:99999;">
  <a href="${site}/gallery" target="_blank" rel="noopener"
     style="font-family:sans-serif;font-size:11px;background:#16110e;color:#f7f1ea;padding:6px 12px;border-radius:999px;text-decoration:none;opacity:0.85;">
    built with lypo &middot; remix this
  </a>
</div>`;

  const html = pageHtml.includes("</body>")
    ? pageHtml.replace("</body>", `${injected}</body>`)
    : pageHtml + injected;

  return (
    <>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
        title={project.name}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function(){});`,
        }}
      />
    </>
  );
}
