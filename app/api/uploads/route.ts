import { createClient } from "@/lib/supabase/server";
import { checkCloudinaryConfig, uploadToCloudinary } from "@/lib/cloudinary";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — matches client-side limits
const CLOUDINARY_MAX = 100 * 1024 * 1024; // Cloudinary's own hard cap

// Logical buckets accepted from clients. Files physically live in Cloudinary
// folders (saves Supabase Storage quota); the bucket only picks the folder.
const ALLOWED_TARGETS = new Set(["materials", "assignments", "submissions", "avatars"]);

/**
 * POST /api/uploads
 * multipart/form-data: { file: File, bucket: string, classId?: string }
 *
 * Returns { success, path, url } — url is a Cloudinary delivery URL that the
 * caller stores in the database (materials.file_url, assignments.attachment_url).
 *
 * Storage history: uploads used to go to Supabase Storage from the browser and
 * failed with "new row violates row-level security policy" after the Supabase
 * project was recreated without storage.objects policies. The route first
 * moved uploads server-side (service client); it now stores files in
 * Cloudinary entirely so Supabase Storage quota is not consumed at all.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Students may only upload into submissions; teachers anywhere.
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "student";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = String(formData.get("bucket") || "");

    if (!file || !bucket) {
      return NextResponse.json({ error: "Missing file or bucket" }, { status: 400 });
    }

    if (!ALLOWED_TARGETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    if (role !== "teacher" && bucket !== "submissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 50MB" }, { status: 400 });
    }
    if (file.size > CLOUDINARY_MAX) {
      return NextResponse.json({ error: "File too large for Cloudinary. Max 100MB" }, { status: 400 });
    }

    const configError = checkCloudinaryConfig();
    if (configError) {
      console.error("[/api/uploads]", configError);
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    // Cloudinary public_ids can't contain "?" or "#" — we never include them,
    // but keep a defensive whitelist anyway.
    const safeExt = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    const publicId = `${Date.now()}-${Math.random().toString(36).substring(7)}.${safeExt}`;

    // Path conventions preserved as Cloudinary folders:
    // assignments → .../assignments/shared/<id>.<ext>
    // materials   → .../materials/<classId>/<id>.<ext> (or root when classId absent)
    // teaching-aids reuse the materials folder via this same route.
    let folder = `myclassroom/${bucket}`;
    if (bucket === "assignments") {
      folder = "myclassroom/assignments/shared";
    } else if (bucket === "materials") {
      const classId = String(formData.get("classId") || "").replace(/[^a-zA-Z0-9-]/g, "");
      folder = classId ? `myclassroom/materials/${classId}` : "myclassroom/materials";
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { secure_url } = await uploadToCloudinary(buffer, {
      folder,
      publicId,
      resourceType: "auto",
    });

    return NextResponse.json({ success: true, path: publicId, url: secure_url });
  } catch (err: any) {
    const detail = err?.message ? ` (${String(err.message).slice(0, 140)})` : "";
    console.error("[/api/uploads] upload error:", err?.message || err);
    return NextResponse.json({ error: "Upload gagal" + detail }, { status: 500 });
  }
}
