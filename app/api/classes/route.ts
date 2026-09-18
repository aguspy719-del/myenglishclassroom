import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Public class list for the register page.
 * The `classes` table is locked behind RLS (auth.uid() IS NOT NULL),
 * so anonymous visitors would get an empty array when querying it
 * directly with the anon key. This route uses the service role key
 * server-side and returns only the fields the dropdown needs.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("classes")
      .select("id, class_name, grade, major")
      .order("grade")
      .order("class_name");

    if (error) {
      console.error("[Classes API] Error:", error.message);
      return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
    }

    return NextResponse.json(
      { classes: data || [] },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (err: any) {
    console.error("[Classes API] Unexpected error:", err?.message);
    return NextResponse.json({ error: "Failed to load classes" }, { status: 500 });
  }
}
