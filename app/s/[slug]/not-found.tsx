import Link from "next/link";

/**
 * Shown when a visitor hits a path that does not exist on a published site.
 *
 * This renders on the owner's own domain, so it stays plain and points back
 * to their home page. Lypo's default 404 would put our branding and our
 * links in front of their customers.
 */
export default function SiteNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "Georgia, 'Times New Roman', serif",
        background: "#fdfcfa",
        color: "#221c17",
      }}
    >
      <h1 style={{ fontSize: "clamp(1.6rem, 5vw, 2.25rem)", margin: 0 }}>
        That page isn&apos;t here
      </h1>
      <p style={{ margin: 0, maxWidth: "32ch", lineHeight: 1.6, color: "#6f6459" }}>
        The link may be old, or the address may have a typo in it.
      </p>
      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
          padding: "0.75rem 1.5rem",
          borderRadius: "999px",
          background: "#221c17",
          color: "#fdfcfa",
          textDecoration: "none",
          fontSize: "0.95rem",
        }}
      >
        Go to the home page
      </Link>
    </main>
  );
}
