"use client";

import { useEffect, useState } from "react";
import {
  Upload, Download, Trash2, FileText, File,
  BookOpen, Calendar, ClipboardList, Target, Loader2, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatFileSize } from "@/lib/utils";

// Document categories
const CATEGORIES = [
  {
    id: "curriculum",
    label: "Curriculum",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    iconBg: "bg-blue-500",
    docs: [
      { key: "cp", label: "CP", fullName: "Capaian Pembelajaran (Learning Outcomes)" },
      { key: "atp", label: "ATP", fullName: "Alur Tujuan Pembelajaran (Learning Pathway)" },
      { key: "tp", label: "TP", fullName: "Tujuan Pembelajaran (Learning Objectives)" },
    ],
  },
  {
    id: "calendar",
    label: "Academic Calendar",
    icon: Calendar,
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    iconBg: "bg-green-500",
    docs: [
      { key: "kaldik", label: "Kaldik", fullName: "Kalender Pendidikan (Academic Calendar)" },
    ],
  },
  {
    id: "planning",
    label: "Annual Planning",
    icon: ClipboardList,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    iconBg: "bg-purple-500",
    docs: [
      { key: "prota", label: "Prota", fullName: "Program Tahunan (Annual Program)" },
      { key: "promes", label: "Promes", fullName: "Program Semester (Semester Program)" },
    ],
  },
  {
    id: "assessment",
    label: "Assessment Criteria",
    icon: Target,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    iconBg: "bg-orange-500",
    docs: [
      { key: "kktp", label: "KKTP", fullName: "Kriteria Ketercapaian Tujuan Pembelajaran (Assessment Criteria)" },
    ],
  },
];

interface DocFile {
  id: string;
  doc_key: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_at: string;
}

export function TeachingAidsClient() {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchFiles = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("teaching_aids")
      .select("*")
      .order("uploaded_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleUpload = async (docKey: string, file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Max 50MB");
      return;
    }

    setUploading(docKey);
    const supabase = createClient();

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${docKey}-${Date.now()}.${fileExt}`;
      const filePath = `teaching-aids/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("materials").getPublicUrl(filePath);

      // Delete old file for this doc_key if exists
      const existing = files.find((f) => f.doc_key === docKey);
      if (existing) {
        await supabase.from("teaching_aids").delete().eq("id", existing.id);
      }

      const { error } = await supabase.from("teaching_aids").insert([{
        doc_key: docKey,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      toast.success(`${docKey.toUpperCase()} uploaded successfully!`);
      fetchFiles();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (id: string, docKey: string) => {
    if (!confirm(`Delete ${docKey.toUpperCase()} document?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("teaching_aids").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Document deleted"); fetchFiles(); }
  };

  const getFileForDoc = (docKey: string) => files.find((f) => f.doc_key === docKey);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(ext || "")) return "📄";
    if (["doc", "docx"].includes(ext || "")) return "📝";
    if (["xls", "xlsx"].includes(ext || "")) return "📊";
    if (["ppt", "pptx"].includes(ext || "")) return "📋";
    return "📎";
  };

  const totalDocs = CATEGORIES.reduce((sum, cat) => sum + cat.docs.length, 0);
  const uploadedDocs = files.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teaching Aids</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Administrative documents for the academic year 2025/2026
        </p>
      </div>

      {/* Progress */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Documents Uploaded</p>
              <p className="text-3xl font-bold mt-1">{uploadedDocs} / {totalDocs}</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${totalDocs > 0 ? (uploadedDocs / totalDocs) * 100 : 0}%` }}
            />
          </div>
          <p className="text-blue-100 text-xs mt-2">
            {totalDocs - uploadedDocs} document{totalDocs - uploadedDocs !== 1 ? "s" : ""} remaining
          </p>
        </CardContent>
      </Card>

      {/* Categories */}
      <Tabs defaultValue="curriculum">
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 text-xs">
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4">
            <div className="space-y-4">
              {cat.docs.map((doc) => {
                const existingFile = getFileForDoc(doc.key);
                const isUploading = uploading === doc.key;

                return (
                  <Card key={doc.key} className="border-0 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 ${cat.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-sm">{doc.label}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 dark:text-white">{doc.label}</p>
                            <Badge className={`text-xs ${cat.color}`}>{cat.label}</Badge>
                            {existingFile ? (
                              <Badge variant="success" className="text-xs">✓ Uploaded</Badge>
                            ) : (
                              <Badge variant="warning" className="text-xs">Not uploaded</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{doc.fullName}</p>

                          {/* Existing file info */}
                          {existingFile && (
                            <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                              <span className="text-xl">{getFileIcon(existingFile.file_name)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {existingFile.file_name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {existingFile.file_size ? formatFileSize(existingFile.file_size) : ""} · {formatDate(existingFile.uploaded_at)}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <a href={existingFile.file_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm" className="gap-1 rounded-xl h-8">
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                  </Button>
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:bg-red-50"
                                  onClick={() => handleDelete(existingFile.id, doc.key)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Upload button */}
                        <div className="flex-shrink-0">
                          <label className="cursor-pointer">
                            <Button
                              variant={existingFile ? "outline" : "default"}
                              size="sm"
                              className="gap-2 rounded-xl pointer-events-none"
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              {isUploading ? "Uploading..." : existingFile ? "Replace" : "Upload"}
                            </Button>
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              disabled={isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(doc.key, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
