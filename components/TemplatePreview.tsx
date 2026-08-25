"use client";

import { derivePalette, type Palette, type Template } from "@/lib/design";

/**
 * A small abstract rendering of what a template looks like, in the colors
 * the owner has actually chosen.
 *
 * Every template draws its own body rather than sharing one generic layout.
 * That is the entire value of the card: nine previews that differ only in
 * their font are nine cards nobody can choose between, and the differences
 * that matter here are structural, not typographic. So the counter preview
 * shows a price list, the gallery preview is mostly photo, and the notice
 * preview is mostly empty space.
 *
 * It is abstract on purpose. Real text at this size is unreadable, and
 * inventing sample copy would be a lie about what the site will say.
 */
export default function TemplatePreview({
  template,
  accent,
  second,
  dark,
}: {
  template: Template;
  /** Falls back to the template's own suggested color. */
  accent?: string | null;
  second?: string | null;
  dark?: boolean;
}) {
  const p = derivePalette(accent || template.defaultAccent, second, dark);
  const t = template.preview;

  const bar = (
    w: string | number,
    color: string,
    h = 3,
    opacity = 1,
    key?: string | number,
  ) => (
    <div
      key={key}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        background: color,
        opacity,
        flexShrink: 0,
      }}
    />
  );

  const headline = (size: number, color = p.ink) => (
    <div
      style={{
        fontFamily: t.displayFamily,
        fontWeight: t.displayWeight,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: t.caps ? "0.02em" : "-0.02em",
        textTransform: t.caps ? "uppercase" : "none",
        color,
      }}
    >
      Name
    </div>
  );

  const button = (color = p.accent, w = 44) => (
    <div
      style={{
        height: 11,
        width: w,
        borderRadius: t.radius,
        background: color,
      }}
    />
  );

  const header = (border = true) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderBottom: border ? `1px solid ${p.line}` : "none",
        flexShrink: 0,
      }}
    >
      {bar("20%", p.ink, 4)}
      <div style={{ display: "flex", gap: 4 }}>
        {bar(9, p.inkSoft, 3, 0.65, 1)}
        {bar(9, p.inkSoft, 3, 0.65, 2)}
        {bar(9, p.inkSoft, 3, 0.65, 3)}
      </div>
    </div>
  );

  return (
    <div
      aria-hidden
      style={{
        background: p.bg,
        color: p.ink,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: 156,
        fontFamily: t.displayFamily,
      }}
    >
      {body(template, p, { bar, headline, button, header })}
    </div>
  );
}

type Kit = {
  bar: (
    w: string | number,
    color: string,
    h?: number,
    opacity?: number,
    key?: string | number,
  ) => React.ReactElement;
  headline: (size: number, color?: string) => React.ReactElement;
  button: (color?: string, w?: number) => React.ReactElement;
  header: (border?: boolean) => React.ReactElement;
};

/** The part that actually differs between templates. */
function body(t: Template, p: Palette, k: Kit): React.ReactElement {
  const { bar, headline, button, header } = k;
  const pad = "10px 12px";

  switch (t.id) {
    // A magazine: hairline rules, left-aligned, an eyebrow under every rule.
    case "editorial":
      return (
        <>
          {header()}
          <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 5 }}>
            {bar("16%", p.accentText, 2)}
            {headline(17)}
            {bar("78%", p.inkSoft, 2, 0.5)}
          </div>
          <div style={{ height: 1, background: p.line, margin: "2px 12px" }} />
          <div style={{ padding: "6px 12px", display: "flex", gap: 10 }}>
            {[0, 1].map((col) => (
              <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                {bar("60%", p.ink, 3, 0.8, "h")}
                {bar("100%", p.inkSoft, 2, 0.45, "a")}
                {bar("92%", p.inkSoft, 2, 0.45, "b")}
                {bar("70%", p.inkSoft, 2, 0.45, "c")}
              </div>
            ))}
          </div>
        </>
      );

    // A studio: air, and a two-column section head.
    case "studio":
      return (
        <>
          {header(false)}
          <div style={{ flex: 1, padding: "14px 12px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
            {headline(17)}
            {bar("62%", p.inkSoft, 2, 0.5)}
            <div style={{ marginTop: 2 }}>{button()}</div>
          </div>
          <div style={{ padding: "10px 12px 12px", display: "flex", gap: 10, borderTop: `1px solid ${p.line}` }}>
            <div style={{ width: "26%" }}>{bar("100%", p.accentText, 2)}</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              {bar("70%", p.ink, 3, 0.85, "h")}
              {bar("100%", p.inkSoft, 2, 0.45, "a")}
              {bar("84%", p.inkSoft, 2, 0.45, "b")}
            </div>
          </div>
        </>
      );

    // A poster: a solid slab of color, hard edges, alternating bands.
    case "stacked":
      return (
        <>
          {header(false)}
          <div
            style={{
              background: p.accent,
              color: p.accentInk,
              padding: "12px 12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {headline(20, p.accentInk)}
            {bar("64%", p.accentInk, 3, 0.6)}
            {button(p.accentInk, 40)}
          </div>
          <div style={{ background: p.surface, flex: 1, padding: pad, display: "flex", flexDirection: "column", gap: 4 }}>
            {bar("40%", p.ink, 4, 0.9)}
            {bar("88%", p.inkSoft, 2, 0.45)}
            {bar("72%", p.inkSoft, 2, 0.45)}
          </div>
        </>
      );

    // Traditional: centered, with an ornament rule and a bordered panel.
    case "classic":
      return (
        <>
          {header()}
          <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            {headline(16)}
            <div style={{ width: 26, height: 2, background: p.accent }} />
            {bar("72%", p.inkSoft, 2, 0.5)}
            {button()}
          </div>
          <div
            style={{
              margin: "0 12px 12px",
              border: `1px solid ${p.line}`,
              background: p.tint ?? p.surface,
              borderRadius: 4,
              padding: "7px 9px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {[0, 1].map((r) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                {bar("34%", p.ink, 2, 0.7, "l")}
                {bar("26%", p.inkSoft, 2, 0.5, "r")}
              </div>
            ))}
          </div>
        </>
      );

    // Photo first: one big image, then an uneven mosaic. Type stays small.
    case "gallery":
      return (
        <>
          <div style={{ height: 74, background: p.surface, position: "relative", flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: p.accent,
                opacity: 0.22,
              }}
            />
          </div>
          <div style={{ padding: "8px 12px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
            {headline(13)}
            {bar("46%", p.inkSoft, 2, 0.45)}
          </div>
          <div style={{ display: "flex", gap: 3, padding: "0 12px 12px", flex: 1 }}>
            <div style={{ flex: 2, background: p.surface }} />
            <div style={{ flex: 1, background: p.accent, opacity: 0.18 }} />
            <div style={{ flex: 1, background: p.surface }} />
          </div>
        </>
      );

    // A menu: rows of item and price with a leader between them.
    case "counter":
      return (
        <>
          {header()}
          <div style={{ padding: "8px 12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {headline(14)}
            {bar("54%", p.inkSoft, 2, 0.5)}
          </div>
          <div
            style={{
              flex: 1,
              margin: "2px 12px 12px",
              background: p.tint ?? p.surface,
              borderRadius: 4,
              padding: "7px 9px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {bar("30%", p.accentText, 2, 1, "eyebrow")}
            {[0, 1, 2].map((r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {bar(r === 1 ? "30%" : "38%", p.ink, 3, 0.8, "n")}
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: `repeating-linear-gradient(to right, ${p.line} 0 2px, transparent 2px 5px)`,
                  }}
                />
                {bar(14, p.ink, 3, 0.8, "p")}
              </div>
            ))}
          </div>
        </>
      );

    // Quiet: one narrow centered column, and mostly empty space.
    case "notice":
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            padding: "18px 24px",
          }}
        >
          {headline(15)}
          {bar("38%", p.inkSoft, 2, 0.5)}
          <div style={{ width: 22, height: 1, background: p.line }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "76%", alignItems: "center" }}>
            {bar("100%", p.inkSoft, 2, 0.35, "a")}
            {bar("86%", p.inkSoft, 2, 0.35, "b")}
          </div>
        </div>
      );

    // Panels floating on a tinted page: the inverse of the usual arrangement.
    case "card":
      return (
        <div style={{ background: p.tint ?? p.surface, flex: 1, padding: 9, display: "flex", flexDirection: "column", gap: 7 }}>
          <div
            style={{
              background: p.bg,
              border: `1px solid ${p.line}`,
              borderRadius: 12,
              padding: "10px 11px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
            }}
          >
            {headline(15)}
            {bar("68%", p.inkSoft, 2, 0.5)}
            {button(p.accent, 40)}
          </div>
          <div style={{ display: "flex", gap: 7, flex: 1 }}>
            {[0, 1].map((c) => (
              <div
                key={c}
                style={{
                  flex: 1,
                  background: p.bg,
                  border: `1px solid ${p.line}`,
                  borderRadius: 12,
                  padding: "8px 9px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {bar("58%", p.ink, 3, 0.8, "h")}
                {bar("100%", p.inkSoft, 2, 0.4, "a")}
                {bar("78%", p.inkSoft, 2, 0.4, "b")}
              </div>
            ))}
          </div>
        </div>
      );

    // Writing: a narrow measure, with one image breaking wider than the text.
    case "journal":
    default:
      return (
        <>
          {header(false)}
          <div style={{ padding: "8px 12px 0", width: "72%" }}>
            {headline(15)}
          </div>
          <div style={{ padding: "5px 12px 7px", width: "72%", display: "flex", flexDirection: "column", gap: 3 }}>
            {bar("100%", p.inkSoft, 2, 0.45, "a")}
            {bar("88%", p.inkSoft, 2, 0.45, "b")}
          </div>
          <div style={{ height: 28, background: p.surface, margin: "0 6px 7px", flexShrink: 0 }} />
          <div style={{ padding: "0 12px 12px", width: "72%", display: "flex", flexDirection: "column", gap: 3 }}>
            {bar("100%", p.inkSoft, 2, 0.45, "c")}
            {bar("64%", p.inkSoft, 2, 0.45, "d")}
          </div>
        </>
      );
  }
}
