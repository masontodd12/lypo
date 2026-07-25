import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";

  const injected = `
<script>
(function () {
  var LYPO_PROJECT_ID = ${JSON.stringify(project.project_id)};
  var LYPO_SUBMIT = ${JSON.stringify(site + "/api/submit")};
  var LYPO_STORE = ${JSON.stringify(site + "/api/store")};

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-lypo-page]");
    if (!link) return;
    e.preventDefault();
    var p = link.getAttribute("data-lypo-page");
    if (!p) return;
    var base = "/s/" + ${JSON.stringify(slug)};
    window.top.location.href = p === "home" ? base : base + "/" + p;
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

  function send(scope, resetTarget) {
    fetch(LYPO_SUBMIT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: LYPO_PROJECT_ID, data: collect(scope) })
    }).then(function () {
      if (resetTarget) {
        resetTarget.innerHTML = '<p style="padding:1.5rem;text-align:center;font-size:1.1rem;">Thanks, your response was received.</p>';
      } else {
        alert("Thanks, your response was received.");
      }
    }).catch(function () {
      alert("Something went wrong sending your response. Please try again.");
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
