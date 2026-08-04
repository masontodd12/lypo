import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // RLS guarantees they can only read their own project's data,
  // but check ownership explicitly for a clean 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, user_id")
    .eq("id", id)
    .single();
  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("data, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const rows = submissions ?? [];
  const columns = Array.from(
    new Set(
      rows.flatMap((s) =>
        s.data && typeof s.data === "object" ? Object.keys(s.data) : [],
      ),
    ),
  );

  function escape(value: unknown) {
    let str =
      value != null && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? "");
    // Field names and values come from a public endpoint. A leading =, +,
    // - or @ is run as a formula by Excel and Sheets, so defang it before
    // the owner opens their own export.
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  const header = ["submitted_at", ...columns.map(escape)].join(",");
  const lines = rows.map((s) =>
    [
      new Date(s.created_at).toISOString(),
      ...columns.map((c) => escape((s.data as Record<string, unknown>)?.[c])),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  const safeName = project.name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="${safeName}-responses.csv"`,
    },
  });
}
