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
  const defaultClass = searchParams.get("class") || "all";

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
      const { data } = await supabase.from("classes").select("*").order("grade").order("class_name");
      setClasses(data || []);
    };
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.deadline) {
      toast.error("Title and deadline are required");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      // Upload file once if provided
      let attachmentUrl = "";
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `shared/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("assignments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("assignments").getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
      }

      // Determine which classes to create assignment for
      const targetClassIds = form.class_id === "all"
        ? classes.map((c) => c.id)
        : [form.class_id];

      // Insert assignment for each class
      const insertData = targetClassIds.map((classId) => ({
        class_id: classId,
        title: form.title,
        description: form.description || null,
        deadline: new Date(form.deadline).toISOString(),
        attachment_url: attachmentUrl || null,
      }));

      const { error } = await supabase.from("assignments").insert(insertData);
      if (error) throw error;

      toast.success(
        form.class_id === "all"
          ? `Assignment created for all ${targetClassIds.length} classes!`
          : "Assignment created successfully!"
      );
      router.push("/assignments");
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Assignment</h1>
          <p className="text-gray-500 dark:text-gray-400">Add assignment for students</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Class selector */}
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="font-semibold text-blue-600">📚 All Classes</span>
                  </SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.class_id === "all" && (
                <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-2 rounded-lg">
                  ✓ Assignment will be created for all {classes.length} classes simultaneously
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Assignment Title *</Label>
              <Input
                placeholder="e.g. Speaking Task - Describing Plans"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Instructions / Description</Label>
              <Textarea
                placeholder="Write detailed assignment instructions..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="rounded-xl"
              />
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label>Deadline *</Label>
              <Input
                type="datetime-local"
                min={minDateTime}
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="rounded-xl"
              />
            </div>

            {/* File attachment */}
            <div className="space-y-2">
              <Label>Attachment File (optional)</Label>
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center hover:border-blue-400 transition-colors">
                {file ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-xl">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload question file</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, DOCX, JPG, PNG. Max 20MB</p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size <= 20 * 1024 * 1024) setFile(f);
                        else if (f) toast.error("File too large. Max 20MB");
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Link href="/assignments" className="flex-1">
                <Button type="button" variant="outline" className="w-full rounded-xl">Cancel</Button>
              </Link>
              <Button type="submit" className="flex-1 rounded-xl" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</>
                ) : (
                  <><ClipboardList className="w-4 h-4 mr-2" />Create Assignment</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
