import { createClient } from "@/lib/supabase/server";
import { checkCloudinaryConfig, uploadToCloudinary } from "@/lib/cloudinary";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * POST — upload a teaching-aids document to Cloudinary & register it in the
 * teaching_aids table. Files live in the myclassroom/teaching-aids folder so
 * Supabase Storage quota is not consumed.
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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;

    if (!file || !category) {
      return NextResponse.json({ error: "Missing file or category" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 50MB" }, { status: 400 });
    }

    const configError = checkCloudinaryConfig();
    if (configError) {
      console.error("[Teaching Aids Upload]", configError);
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    const fileExt = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    const publicId = `ta-${category}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { secure_url } = await uploadToCloudinary(buffer, {
      folder: "myclassroom/teaching-aids",
      publicId,
      resourceType: "auto",
    });

    const { error: dbError } = await supabase.from("teaching_aids").insert({
      category,
      file_name: file.name,
      file_url: secure_url,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
    });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: secure_url });
  } catch (err: any) {
    const detail = err?.message ? ` (${String(err.message).slice(0, 140)})` : "";
    console.error("[Teaching Aids Upload] Error:", err?.message || err);
    return NextResponse.json({ error: "Upload gagal" + detail }, { status: 500 });
  }
}
