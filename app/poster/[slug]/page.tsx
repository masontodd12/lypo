import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { siteUrlFor } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function Poster({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name, story")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .single();

  if (!project) notFound();

  const liveUrl = siteUrlFor(slug);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(liveUrl)}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper p-8">
      <div className="w-full max-w-md rounded-2xl border-2 border-ink p-10 text-center print:border-4">
        <p className="font-display text-4xl font-semibold tracking-tight">
          {project.name}
          <span className="text-flame">.</span>
        </p>
        {project.story && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            {project.story}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code linking to ${liveUrl}`}
          className="mx-auto mt-8 h-56 w-56"
        />
        <p className="font-display mt-6 text-lg font-semibold">
          scan to visit
        </p>
        <p className="mt-1 text-xs break-all text-ink-soft">{liveUrl}</p>
        <p className="mt-8 text-[10px] tracking-[0.3em] text-faint uppercase">
          built with lypo
        </p>
      </div>
      <PrintButton />
    </main>
  );
}
