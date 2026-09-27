"use client";

/**
 * Direct browser → Cloudinary upload using a signature from /api/uploads/sign.
 *
 * Why not POST /api/uploads: Vercel caps Function request bodies at 4.5MB, so
 * any larger file failed with a non-JSON response and the client showed a
 * generic "Gagal upload" toast. With the signed flow the file never passes
 * through our server.
 *
 * Cloudinary free plan caps raw files (pptx/docx/pdf...) at 10MB.
 */
const RAW_FILE_LIMIT = 10 * 1024 * 1024; // 10MB — Cloudinary free plan raw cap

export interface DirectUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload a file directly to Cloudinary from the browser.
 * `onProgress` receives 0–100 as the upload advances (XHR, not fetch).
 */
export async function uploadFileDirect(
  file: File,
  bucket: "materials" | "assignments" | "submissions" | "teaching-aids",
  options: { classId?: string; onProgress?: (pct: number) => void } = {}
): Promise<DirectUploadResult> {
  const { classId = "", onProgress } = options;

  if (file.size > RAW_FILE_LIMIT) {
    throw new Error("File terlalu besar. Maksimal 10MB (batas plan gratis Cloudinary)");
  }

  // 1. Get signature — small JSON request, well under any body limit.
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, classId, fileSize: file.size }),
  });
  const sign = await signRes.json().catch(() => ({}));
  if (!signRes.ok || !sign.signature) {
    throw new Error(sign.error || "Gagal menyiapkan upload");
  }

  // 2. Upload straight to Cloudinary.
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sign.apiKey);
  fd.append("timestamp", String(sign.timestamp));
  fd.append("signature", sign.signature);
  fd.append("folder", sign.folder);

  const url = await new Promise<DirectUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("Koneksi ke server upload gagal"));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          resolve({ url: res.secure_url, publicId: res.public_id });
        } else {
          reject(new Error(res?.error?.message || "Upload ke Cloudinary gagal"));
        }
      } catch {
        reject(new Error("Respons upload tidak valid"));
      }
    };
    xhr.send(fd);
  });

  return url;
}
