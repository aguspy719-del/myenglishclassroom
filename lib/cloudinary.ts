import { v2 as cloudinary } from "cloudinary";

// Cloudinary config — credentials live in .env.local / Vercel env vars.
// Shared by the avatar, uploads (materials/assignments), and teaching-aids routes.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Fail fast with a CLEAR message when Cloudinary env vars are missing */
export function checkCloudinaryConfig(): string | null {
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
 * Upload a buffer to Cloudinary and return its delivery URL + public_id.
 * resource_type "auto" handles PDFs, Office docs, audio, video, and images.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    publicId: string;
    resourceType?: "auto" | "image" | "video" | "raw";
    transformations?: object[];
    format?: string;
  }
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? "auto",
        transformation: options.transformations,
        format: options.format,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error("Upload gagal"));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Extract the public_id from a Cloudinary delivery URL.
 * e.g. .../myclassroom/avatars/abc-123.webp → myclassroom/avatars/abc-123
 */
export function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("res.cloudinary.com")) return null;
    const parts = u.pathname.split("/"); // /<cloud>/<type>/upload/v123.../folder/name.ext
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
