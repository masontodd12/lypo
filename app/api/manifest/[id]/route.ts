import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name, slug")
    .eq("id", id)
    .single();

  return NextResponse.json(
    {
      name: project?.name ?? "Lypo App",
      short_name: (project?.name ?? "Lypo").slice(0, 12),
      start_url: `/s/${project?.slug ?? ""}`,
      display: "standalone",
      background_color: "#fdfcfa",
      theme_color: "#e8542f",
      icons: [
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
