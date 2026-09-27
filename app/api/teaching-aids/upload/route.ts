import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST — register a teaching-aids document in the teaching_aids table.
 *
 * The file itself is uploaded DIRECTLY from the browser to Cloudinary using a
 * signature from /api/uploads/sign (bucket "teaching-aids"). This route used
 * to receive the file as multipart/form-data, but that breaks on Vercel's
 * 4.5MB request body limit, so now it only records the metadata.
 *
 * JSON: { category, file_name, file_url, file_size }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check teacher role
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const category = String(body.category || "");
    const fileName = String(body.file_name || "");
    const fileUrl = String(body.file_url || "");
    const fileSize = Number(body.file_size || 0);

    if (!category || !fileName || !fileUrl) {
      return NextResponse.json({ error: "Missing category, file_name or file_url" }, { status: 400 });
    }

    // Only accept Cloudinary URLs so the DB can't be filled with arbitrary links
    if (!fileUrl.includes("res.cloudinary.com")) {
      return NextResponse.json({ error: "Invalid file_url" }, { status: 400 });
    }

    const { error: dbError } = await supabase.from("teaching_aids").insert({
      category,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      uploaded_at: new Date().toISOString(),
    });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("[Teaching Aids Upload] Error:", err?.message || err);
    return NextResponse.json({ error: "Gagal menyimpan dokumen" }, { status: 500 });
  }
}
