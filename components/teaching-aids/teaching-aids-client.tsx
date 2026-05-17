"use client";

import { useEffect, useState, useRef } from "react";
import {
  Upload, Download, Trash2, FileText,
  BookOpen, Calendar, ClipboardList, Target, Loader2, Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatFileSize } from "@/lib/utils";

const CATEGORIES = [
  {
    id: "curriculum",
    label: "Curriculum",
    icon: BookOpen,
    color: "bg-blue-500",
    lightColor: "bg-blue-50 dark:bg-blue-950",
    textColor: "text-blue-700 dark:text-blue-300",
    description: "CP, ATP, TP, and Teaching Module documents",
    suggestedDocs: ["CP + ATP + TP (Combined)", "Teaching Module"],
  },
  {
    id: "calendar",
    label: "Academic Calendar",
    icon: Calendar,
    color: "bg-green-500",
    lightColor: "bg-green-50 dark:bg-green-950",
    textColor: "text-green-700 dark:text-green-300",
    description: "Kalender Pendidikan (Academic Calendar)",
    suggestedDocs: ["Kaldik 2025/2026"],
  },
  {
    id: "planning",
    label: "Annual Planning",
    icon: ClipboardList,
    color: "bg-purple-500",
    lightColor: "bg-purple-50 dark:bg-purple-950",
    textColor: "text-purple-700 dark:text-purple-300",
    description: "Prota and Promes documents",
    suggestedDocs: ["Prota (Annual Program)", "Promes Semester 1", "Promes Semester 2"],
  },
  {
    id: "assessment_criteria",
    label: "Assessment Criteria",
    icon: Target,
    color: "bg-orange-500",
    lightColor: "bg-orange-50 dark:bg-orange-950",
    textColor: "text-orange-700 dark:text-orange-300",
    description: "KKTP and assessment rubric documents",
    suggestedDocs: ["KKTP", "Assessment Rubric"],
  },
];

interface DocFile {
  id: string;
  category: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  description?: string;
  uploaded_at: string;
}

export function TeachingAidsClient() {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchFiles = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("teaching_aids")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (!error) setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleUpload = async (category: string, selectedFiles: FileList) => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    const supabase = createClient();
    let successCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 50MB`);
        continue;
      }

      try {
        setUploadProgress(Math.round(((i + 0.5) / selectedFiles.length) * 100));
        const fileExt = file.name.split(".").pop();
        const fileName = `teaching-aids/${category}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("materials")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("materials").getPublicUrl(fileName);

        const { error: dbError } = await supabase.from("teaching_aids").insert([{
          category,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        }]);

        if (dbError) throw dbError;
        successCount++;
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully!`);
      fetchFiles();
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("teaching_aids").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("File deleted"); fetchFiles(); }
  };

  const getFilesForCategory = (category: string) =>
    files.filter((f) => f.category === category);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (["doc", "docx"].includes(ext || "")) return "📝";
    if (["xls", "xlsx"].includes(ext || "")) return "📊";
    if (["ppt", "pptx"].includes(ext || "")) return "📋";
    return "📎";
  };

  const totalUploaded = files.length;
  const totalExpected = CATEGORIES.reduce((sum, cat) => sum + cat.suggestedDocs.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teaching Aids</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Administrative documents for academic year 2025/2026
        </p>
      </div>

      {/* Summary card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-100 text-sm">Total Documents Uploaded</p>
              <p className="text-4xl font-bold mt-1">{totalUploaded}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => {
              const count = getFilesForCategory(cat.id).length;
              return (
                <div key={cat.id} className="bg-white/15 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs text-blue-200 mt-0.5 truncate">{cat.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload progress */}
      {uploading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploading...</p>
              <p className="text-sm text-gray-500">{uploadProgress}%</p>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="curriculum">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          {CATEGORIES.map((cat) => {
            const count = getFilesForCategory(cat.id).length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 text-xs">
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
                {count > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((cat) => {
          const catFiles = getFilesForCategory(cat.id);
          return (
            <TabsContent key={cat.id} value={cat.id} className="mt-4 space-y-4">
              {/* Category header */}
              <div className={`p-4 ${cat.lightColor} rounded-2xl`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${cat.color} rounded-xl flex items-center justify-center`}>
                      <cat.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className={`font-semibold ${cat.textColor}`}>{cat.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>
                    </div>
                  </div>
                  {/* Upload button */}
                  <label className="cursor-pointer">
                    <Button
                      className={`gap-2 rounded-xl pointer-events-none ${cat.color} text-white hover:opacity-90`}
                      disabled={uploading}
                      size="sm"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Upload Files
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      disabled={uploading}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleUpload(cat.id, e.target.files);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {/* Suggested docs hint */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 w-full">Suggested documents:</p>
                  {cat.suggestedDocs.map((doc) => (
                    <span key={doc} className="text-xs bg-white/60 dark:bg-gray-800/60 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400">
                      {doc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Files list */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : catFiles.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Upload className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No files uploaded yet</p>
                  <p className="text-sm mt-1">Click "Upload Files" to add documents</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {catFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm group hover:shadow-md transition-shadow"
                    >
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                        {getFileIcon(file.file_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {file.file_size ? formatFileSize(file.file_size) : ""} · {formatDate(file.uploaded_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 text-xs">
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(file.id, file.file_name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
