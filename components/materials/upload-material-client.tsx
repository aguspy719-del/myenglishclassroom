"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
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

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selected.size > maxSize) {
      toast.error("File terlalu besar. Maksimal 50MB");
      return;
    }
    setFile(selected);
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
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${form.class_id}/${fileName}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("materials")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        setUploadProgress(70);

        const { data: urlData } = supabase.storage.from("materials").getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
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
      toast.success("Materi berhasil diupload");
      router.push("/materials");
    } catch (err: any) {
      toast.error("Gagal upload: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/materials">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Materi</h1>
          <p className="text-gray-500 dark:text-gray-400">Tambah materi pelajaran baru</p>
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
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                {file ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-blue-600" />
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
                      PDF, DOCX, PPT, MP4, dll. Maks 50MB
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
              <Link href="/materials" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Batal
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Mengupload...
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
