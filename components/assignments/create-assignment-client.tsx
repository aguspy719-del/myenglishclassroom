"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Loader2, File, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";
import type { User, Class } from "@/types";

interface CreateAssignmentClientProps {
  user: User;
}

export function CreateAssignmentClient({ user }: CreateAssignmentClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultClass = searchParams.get("class") || "";

  const [classes, setClasses] = useState<Class[]>([]);
  const [form, setForm] = useState({
    class_id: defaultClass,
    title: "",
    description: "",
    deadline: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("classes").select("*").order("class_name");
      setClasses(data || []);
    };
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.class_id || !form.title || !form.deadline) {
      toast.error("Kelas, judul, dan deadline harus diisi");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    let attachmentUrl = "";

    try {
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${form.class_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("assignments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("assignments").getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("assignments").insert([{
        class_id: form.class_id,
        title: form.title,
        description: form.description || null,
        deadline: new Date(form.deadline).toISOString(),
        attachment_url: attachmentUrl || null,
      }]);

      if (error) throw error;

      toast.success("Tugas berhasil dibuat");
      router.push("/assignments");
    } catch (err: any) {
      toast.error("Gagal membuat tugas: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setSubmitting(false);
    }
  };

  // Get minimum datetime (now)
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/assignments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Tugas Baru</h1>
          <p className="text-gray-500 dark:text-gray-400">Tambah tugas untuk siswa</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Kelas *</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
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

            <div className="space-y-2">
              <Label>Judul Tugas *</Label>
              <Input
                placeholder="Contoh: Speaking Task - Describing Plans"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Instruksi / Deskripsi</Label>
              <Textarea
                placeholder="Tuliskan instruksi tugas secara detail..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Deadline *</Label>
              <Input
                type="datetime-local"
                min={minDateTime}
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>File Lampiran (opsional)</Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 text-center hover:border-blue-400 transition-colors">
                {file ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Upload file soal (opsional)</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOCX, JPG, PNG. Maks 20MB</p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size <= 20 * 1024 * 1024) setFile(f);
                        else if (f) toast.error("File terlalu besar. Maks 20MB");
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/assignments" className="flex-1">
                <Button type="button" variant="outline" className="w-full">Batal</Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Menyimpan...</>
                ) : (
                  <><ClipboardList className="w-4 h-4 mr-2" />Buat Tugas</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
