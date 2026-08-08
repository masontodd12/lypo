import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "health" },
  { href: "/admin/sites", label: "sites" },
  { href: "/admin/usage", label: "usage" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // notFound rather than a redirect or a 403: someone who is not an admin
  // should not be able to tell that these pages exist at all.
  if (!isAdmin(user)) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-5">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="font-display text-sm font-semibold tracking-[0.3em]"
          >
            LYPO<span className="text-flame">.</span>
          </Link>
          <span className="rounded-full border border-flame/40 px-2 py-0.5 text-[10px] font-medium tracking-widest text-flame uppercase">
            admin
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="text-ink-soft transition hover:text-flame"
            >
              {t.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="text-faint transition hover:text-flame"
          >
            back to projects
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
