"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Loader2, File, X, Upload, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { User, Class } from "@/types";

interface CreateAssignmentClientProps {
  user: User;
}

export function CreateAssignmentClient({ user }: CreateAssignmentClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultClass = searchParams.get("class") || "";

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    defaultClass ? [defaultClass] : []
  );
  const [form, setForm] = useState({ title: "", description: "", deadline: "", publishAt: "" });
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

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const toggleAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map((c) => c.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClasses.length === 0) {
      toast.error("Please select at least one class");
      return;
    }
    if (!form.title || !form.deadline) {
      toast.error("Title and deadline are required");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      let attachmentUrl = "";
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("assignments")
          .upload(`shared/${fileName}`, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("assignments").getPublicUrl(`shared/${fileName}`);
        attachmentUrl = urlData.publicUrl;
      }

      const insertData = selectedClasses.map((classId) => ({
        class_id: classId,
        title: form.title,
        description: form.description || null,
        deadline: new Date(form.deadline).toISOString(),
        attachment_url: attachmentUrl || null,
        published_at: form.publishAt ? new Date(form.publishAt).toISOString() : new Date().toISOString(),
      }));

      const { error } = await supabase.from("assignments").insert(insertData);
      if (error) throw error;

      // Send push notification to students in selected classes
      try {
        const { data: students } = await supabase
          .from("users")
          .select("id")
          .in("class_id", selectedClasses)
          .eq("role", "student");

        if (students && students.length > 0) {
          await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: students.map((s) => s.id),
              payload: {
                title: "📋 New Assignment",
                body: form.title,
                url: "/classes",
              },
            }),
          });
        }
      } catch {
        // Push failure should not block the main flow
      }

      toast.success(
        selectedClasses.length === 1
          ? "Assignment created successfully!"
          : `Assignment created for ${selectedClasses.length} classes!`
      );
      // Redirect back to the class if came from one, otherwise to classes
      const classId = searchParams.get("class");
      if (classId) {
        router.push(`/classes/${classId}`);
      } else {
        router.push("/classes");
      }
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  };

  const minDateTime = new Date().toISOString().slice(0, 16);
  const allSelected = selectedClasses.length === classes.length;
  const someSelected = selectedClasses.length > 0 && !allSelected;

  // Group by grade
  const gradeXI = classes.filter((c) => c.grade === "XI");
  const gradeXII = classes.filter((c) => c.grade === "XII");

  const classId = searchParams.get("class");
  const backUrl = classId ? `/classes/${classId}` : "/classes";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Assignment</h1>
          <p className="text-gray-500 dark:text-gray-400">Add assignment for one or more classes</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Class Multi-Select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Classes *</Label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                >
                  {allSelected ? (
                    <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                  ) : (
                    <><Square className="w-3.5 h-3.5" /> Select All</>
                  )}
                </button>
              </div>

              {/* Selected count badge */}
              {selectedClasses.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950 rounded-xl">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    ✓ {selectedClasses.length} class{selectedClasses.length > 1 ? "es" : ""} selected
                  </span>
                  <span className="text-xs text-blue-500 dark:text-blue-400">
                    — assignment will be sent to all selected classes
                  </span>
                </div>
              )}

              {/* Grade XI */}
              {gradeXI.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Grade XI</p>
                  <div className="grid grid-cols-2 gap-2">
                    {gradeXI.map((cls) => {
                      const isSelected = selectedClasses.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleClass(cls.id)}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"
                          )}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{cls.class_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grade XII */}
              {gradeXII.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-3">Grade XII</p>
                  <div className="grid grid-cols-2 gap-2">
                    {gradeXII.map((cls) => {
                      const isSelected = selectedClasses.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleClass(cls.id)}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"
                          )}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{cls.class_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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

            {/* Scheduled Publish */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Publish Schedule (optional)</Label>
                {form.publishAt && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, publishAt: "" })}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear (publish now)
                  </button>
                )}
              </div>
              <Input
                type="datetime-local"
                min={minDateTime}
                value={form.publishAt}
                onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                className="rounded-xl"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {form.publishAt
                  ? `⏰ Assignment will be visible to students on ${new Date(form.publishAt).toLocaleString()}`
                  : "Leave empty to publish immediately"}
              </p>
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
              <Link href={backUrl} className="flex-1">
                <Button type="button" variant="outline" className="w-full rounded-xl">Cancel</Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 rounded-xl"
                disabled={submitting || selectedClasses.length === 0}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</>
                ) : (
                  <><ClipboardList className="w-4 h-4 mr-2" />
                    Create for {selectedClasses.length || 0} Class{selectedClasses.length !== 1 ? "es" : ""}
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
