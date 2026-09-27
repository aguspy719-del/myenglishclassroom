"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, File, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { uploadFileDirect } from "@/lib/upload-client";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";
import type { User, Class } from "@/types";

interface UploadMaterialClientProps {
  user: User;
}

export function UploadMaterialClient({ user }: UploadMaterialClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultClass = searchParams.get("class") || "";

  const [classes, setClasses] = useState<Class[]>([]);
  const [form, setForm] = useState({
    class_id: defaultClass,
    title: "",
    description: "",
    topic: "",
    meeting: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [rejectedFile, setRejectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const fetchClasses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("classes").select("*").order("class_name");
      setClasses(data || []);
    };
    fetchClasses();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Cloudinary free plan caps raw files (pptx/docx/pdf...) at 10MB
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selected.size > maxSize) {
      toast.error("File terlalu besar. Maksimal 10MB");
      setRejectedFile(selected);
      setFile(null);
      return;
    }
    setFile(selected);
    setRejectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.class_id || !form.title) {
      toast.error("Kelas dan judul harus diisi");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    const supabase = createClient();
    let fileUrl = "";

    try {
      if (file) {
        setUploadProgress(30);
        // Signed DIRECT upload to Cloudinary: proxying the file through a
        // server route breaks on Vercel's 4.5MB request body limit, which is
        // why larger PPT/DOCX uploads started failing after the Cloudinary
        // migration. The server only provides a signature; the file goes
        // straight from the browser to Cloudinary.
        const result = await uploadFileDirect(file, "materials", {
          classId: form.class_id,
          onProgress: (pct) => setUploadProgress(30 + Math.round(pct * 0.5)),
        });
        fileUrl = result.url;
      }

      setUploadProgress(90);

      const { error } = await supabase.from("materials").insert([{
        class_id: form.class_id,
        title: form.title,
        description: form.description || null,
        topic: form.topic || null,
        meeting: form.meeting ? parseInt(form.meeting) : null,
        file_url: fileUrl || null,
      }]);

      if (error) throw error;

      setUploadProgress(100);

      // Notify students in the class instantly — bell badge updates without
      // refresh via the realtime subscription in components/layout/notifications.tsx
      try {
        const { data: students } = await supabase
          .from("users")
          .select("id")
          .eq("class_id", form.class_id)
          .eq("role", "student");

        if (students && students.length > 0) {
          await supabase.from("notifications").insert(
            students.map((s) => ({
              user_id: s.id,
              title: "📘 New Material",
              message: form.title,
              type: "info" as const,
              link: `/classes/${form.class_id}`,
            }))
          );

          await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: students.map((s) => s.id),
              payload: {
                title: "📘 New Material",
                body: form.title,
                url: `/classes/${form.class_id}`,
              },
            }),
          }).catch(() => {});
        }
      } catch {
        // Notification failure should not block the upload
      }

      toast.success("Material uploaded successfully!");
      // Go back to class if came from one
      const classId = searchParams.get("class") || form.class_id;
      if (classId) {
        router.push(`/classes/${classId}`);
      } else {
        router.push("/classes");
      }
    } catch (err: any) {
      toast.error("Gagal upload: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const classId = searchParams.get("class") || form.class_id;
  const backUrl = classId ? `/classes/${classId}` : "/classes";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Material</h1>
          <p className="text-gray-500 dark:text-gray-400">Add new learning material</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Class */}
            <div className="space-y-2">
              <Label>Kelas *</Label>
              <Select
                value={form.class_id}
                onValueChange={(v) => setForm({ ...form, class_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Judul Materi *</Label>
              <Input
                placeholder="Contoh: Hope and Plan - Introduction"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            {/* Topic & Meeting */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Topik</Label>
                <Input
                  placeholder="Contoh: Hope & Plan"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pertemuan ke-</Label>
                <Input
                  type="number"
                  placeholder="Contoh: 1"
                  min="1"
                  value={form.meeting}
                  onChange={(e) => setForm({ ...form, meeting: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                placeholder="Deskripsi singkat tentang materi ini..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>File Materi</Label>

              {/* Oversize hint — toast alone disappears, this stays visible */}
              {rejectedFile && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        &ldquo;{rejectedFile.name}&rdquo; ({formatFileSize(rejectedFile.size)}) melebihi batas 10MB
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Compress dulu file-nya, lalu upload ulang:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-amber-700 dark:text-amber-300">
                        <li>
                          Buka file di PowerPoint → <b>File → Info → Compress Pictures</b> → pilih Email (96 ppi)
                        </li>
                        <li>
                          Atau lewat web: <a href="https://www.ilovepdf.com/compress_ppt" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">ilovepdf.com/compress_ppt</a>
                        </li>
                        <li>Save / download hasilnya, lalu pilih lagi di sini</li>
                      </ol>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                        PPT besar biasanya karena gambar — setelah compress biasanya turun jadi 2–5MB. Kualitas tetap cukup untuk proyektor kelas.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400"
                      onClick={() => setRejectedFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors">
                {file ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-emerald-600" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Klik untuk upload file
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOCX, PPT, MP4, dll. Maks 10MB
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.avi,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload Progress */}
            {uploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Mengupload...</span>
                  <span className="text-gray-600 dark:text-gray-400">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Link href={backUrl} className="flex-1">
                <Button type="button" variant="outline" className="w-full rounded-xl">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="flex-1 rounded-xl" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Materi
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
