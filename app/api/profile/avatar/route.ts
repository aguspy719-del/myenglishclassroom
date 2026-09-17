import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config — credentials live in .env.local / Vercel env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — keeps uploads light & fast
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Fail fast with a CLEAR message when Cloudinary env vars are missing (e.g. not set in Vercel) */
function checkCloudinaryConfig(): string | null {
  const missing: string[] = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");
  if (missing.length > 0) {
    return `Server upload is not configured. Missing environment variables: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables, then redeploy.`;
  }
  return null;
}

/**
 * Extract the public_id from a Cloudinary delivery URL.
 * e.g. .../myclassroom/avatars/abc-123.jpg → myclassroom/avatars/abc-123
 */
function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return null;
    const parts = u.pathname.split("/"); // /<cloud>/image/upload/v123.../folder/name.jpg
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    const path = parts
      .slice(uploadIdx + 1)
      .filter((p) => !/^v\d+$/.test(p)) // drop version segment
      .join("/");
    return path.replace(/\.[a-z0-9]+$/i, ""); // drop extension
  } catch {
    return null;
  }
}

/** POST — upload a new avatar to Cloudinary & save the URL on the user row */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Verify the caller is logged in
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Config check BEFORE accepting the file — exact reason, no vague "gagal"
    const configError = checkCloudinaryConfig();
    if (configError) {
      console.error("[Avatar Upload]", configError);
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    // 3. Validate the file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format harus JPG, PNG, atau WebP" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran maksimal 5MB" },
        { status: 400 }
      );
    }

    // 4. Upload to Cloudinary (server-side, signed) — 400px square, face-focused
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "myclassroom/avatars",
            public_id: `${authUser.id}-${Date.now()}`,
            transformation: [
              { width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto:good" },
            ],
            format: "webp", // smallest size for a profile photo
            overwrite: false,
          },
          (error, result) => {
            if (error || !result) reject(error || new Error("Upload gagal"));
            else resolve({ secure_url: result.secure_url, public_id: result.public_id });
          }
        );
        stream.end(buffer);
      }
    );

    // 5. Delete the previous Cloudinary asset so the quota is not eaten
    const { data: profile } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("id", authUser.id)
      .single();
    const oldId = profile?.avatar_url ? publicIdFromUrl(profile.avatar_url) : null;
    if (oldId) {
      cloudinary.uploader.destroy(oldId).catch(() => {});
    }

    // 6. Save the new URL on the user row
    const { error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: uploadResult.secure_url })
      .eq("id", authUser.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Gagal menyimpan foto profil: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, avatar_url: uploadResult.secure_url });
  } catch (err: any) {
    // Surface the REAL reason (invalid credentials, network, etc.) instead of a vague failure
    const detail = err?.message ? ` (${String(err.message).slice(0, 140)})` : "";
    console.error("[Avatar Upload] Error:", err);
    return NextResponse.json(
      { error: "Gagal mengupload foto" + detail },
      { status: 500 }
    );
  }
}

/** DELETE — remove the avatar (both the Cloudinary asset and the DB URL) */
export async function DELETE() {
  try {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configError = checkCloudinaryConfig();
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("avatar_url")
      .eq("id", authUser.id)
      .single();

    const oldId = profile?.avatar_url ? publicIdFromUrl(profile.avatar_url) : null;
    if (oldId) {
      cloudinary.uploader.destroy(oldId).catch(() => {});
    }

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: null })
      .eq("id", authUser.id);
    if (error) {
      return NextResponse.json({ error: "Gagal menghapus foto" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const detail = err?.message ? ` (${String(err.message).slice(0, 140)})` : "";
    console.error("[Avatar Delete] Error:", err);
    return NextResponse.json({ error: "Gagal menghapus foto" + detail }, { status: 500 });
  }
}
