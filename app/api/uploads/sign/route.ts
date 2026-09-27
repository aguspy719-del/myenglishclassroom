import { createClient } from "@/lib/supabase/server";
import { checkCloudinaryConfig } from "@/lib/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

/**
 * POST /api/uploads/sign
 * JSON: { bucket: "materials" | "assignments" | "submissions", classId?: string }
 *
 * Returns the params + signature for a DIRECT browser → Cloudinary upload.
 *
 * Why: Vercel caps a Function request body at 4.5MB, so proxying uploads
 * through /api/uploads breaks for any file bigger than that (404/413 from
 * Vercel, non-JSON response → "Gagal upload file materi" on the client).
 * With a signed upload only a tiny JSON request hits our server; the file
 * itself goes straight from the browser to Cloudinary.
 *
 * Cloudinary free plan caps raw files (pptx/docx/pdf...) at 10MB — enforced
 * client-side in lib/upload-client.ts with a clear error message.
 */
const ALLOWED_BUCKETS = new Set(["materials", "assignments", "submissions", "teaching-aids"]);
const RAW_FILE_LIMIT = 10 * 1024 * 1024; // Cloudinary free plan raw cap

// Mirrors the folder logic of /api/uploads so both routes stay consistent.
function folderFor(bucket: string, classId: string): string {
  if (bucket === "assignments") return "myclassroom/assignments/shared";
  if (bucket === "teaching-aids") return "myclassroom/teaching-aids";
  if (bucket === "materials") {
    const safe = classId.replace(/[^a-zA-Z0-9-]/g, "");
    return safe ? `myclassroom/materials/${safe}` : "myclassroom/materials";
  }
  return `myclassroom/${bucket}`;
}

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

    const body = await request.json().catch(() => ({}));
    const bucket = String(body.bucket || "");
    const classId = String(body.classId || "");
    const fileSize = Number(body.fileSize || 0);

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    // Students may only upload into submissions; teaching-aids is teacher-only.
    if (role !== "teacher" && bucket !== "submissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 10MB+ raw files would be rejected by Cloudinary anyway — fail here with
    // a message that actually tells the user why, instead of a cryptic one
    // after the upload has already transferred.
    if (fileSize > RAW_FILE_LIMIT) {
      return NextResponse.json(
        { error: "File terlalu besar. Maksimal 10MB (batas plan gratis Cloudinary)" },
        { status: 400 }
      );
    }

    const configError = checkCloudinaryConfig();
    if (configError) {
      console.error("[/api/uploads/sign]", configError);
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = folderFor(bucket, classId);

    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      process.env.CLOUDINARY_API_SECRET as string
    );

    return NextResponse.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      timestamp,
      signature,
    });
  } catch (err: any) {
    console.error("[/api/uploads/sign] error:", err?.message || err);
    return NextResponse.json({ error: "Gagal membuat signature upload" }, { status: 500 });
  }
}
