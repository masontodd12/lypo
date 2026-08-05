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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  const project = await getProject(slug);
  return {
    title: project ? `${project.name} — ${page}` : "Lypo site",
  };
}

export default async function PublicSubPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  const project = await getProject(slug);
  const pagesMap = (project?.pages ?? null) as Record<string, string> | null;
  const pageHtml = pagesMap?.[page];
  if (!project || !pageHtml) notFound();

  // Count the view (best-effort, never blocks the render)
  try {
    const supabase = await createClient();
    await supabase.rpc("increment_site_view", { pid: project.project_id });
  } catch {
    // analytics table not migrated yet; the site still renders
  }

  const site = appOrigin();

  const requestHost = ((await headers()).get("host") ?? "").toLowerCase();
  const navBase = requestHost.startsWith(`${slug}.`) ? "" : `/s/${slug}`;

  const injected = `
<script>
(function () {
  var LYPO_PROJECT_ID = ${JSON.stringify(project.project_id)};
  var LYPO_SUBMIT = ${JSON.stringify(site + "/api/submit")};
  var LYPO_EVENT = ${JSON.stringify(site + "/api/event")};

  // See the single-page renderer: taps are what tell an owner the site works.
  function track(ev) {
    try {
      var body = JSON.stringify({ projectId: LYPO_PROJECT_ID, event: ev });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(LYPO_EVENT, new Blob([body], { type: "application/json" }));
      } else {
        fetch(LYPO_EVENT, { method: "POST", headers: { "content-type": "application/json" }, body: body, keepalive: true });
      }
    } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = (a.getAttribute("href") || "").toLowerCase();
    if (href.indexOf("tel:") === 0) return track("call");
    if (href.indexOf("maps.google") > -1 || href.indexOf("google.com/maps") > -1) return track("directions");
    if (/instagram|facebook|tiktok|twitter|x\.com|youtube/.test(href)) return track("social");
  }, true);
  var LYPO_STORE = ${JSON.stringify(site + "/api/store")};

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-lypo-page]");
    if (!link) return;
    e.preventDefault();
    var p = link.getAttribute("data-lypo-page");
    if (!p) return;
    var base = ${JSON.stringify(navBase)};
    window.top.location.href = p === "home" ? (base || "/") : base + "/" + p;
  }, true);

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

  var typed = {};
  function keyFor(el) { return el.name || el.id || el.getAttribute("placeholder") || ""; }
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
})();
</script>`;

  const html = pageHtml.includes("</body>")
    ? pageHtml.replace("</body>", `${injected}</body>`)
    : pageHtml + injected;

  return (
    <iframe
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
      title={`${project.name} — ${page}`}
    />
  );
}
