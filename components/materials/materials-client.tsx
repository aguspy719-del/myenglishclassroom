"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Plus,
  Search,
  Download,
  Trash2,
  FileText,
  Video,
  File,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { fetchWithCache } from "@/lib/offline-cache";
import { toast } from "sonner";
import { formatDate, getFileIcon } from "@/lib/utils";
import type { User, Material, Class } from "@/types";

interface MaterialsClientProps {
  user: User;
}

export function MaterialsClient({ user }: MaterialsClientProps) {
  const searchParams = useSearchParams();
  const classFilter = searchParams.get("class") || "all";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState(classFilter);
  const [selectedTopic, setSelectedTopic] = useState("all");

  const fetchData = async () => {
    const supabase = createClient();

    // Use cache for student materials (most important for offline)
    const cacheKey = user.role === "student" ? "materials" : `materials_${selectedClass}`;

    const { data: matsData, fromCache } = await fetchWithCache<Material>(
      "materials",
      async () => {
        let query = supabase
          .from("materials")
          .select("*, class:classes(class_name, major)")
          .order("created_at", { ascending: false });

        if (user.role === "student" && user.class_id) {
          query = query.eq("class_id", user.class_id);
        } else if (selectedClass !== "all") {
          query = query.eq("class_id", selectedClass);
        }

        const { data } = await query;
        return data || [];
      }
    );

    const { data: classesData } = await fetchWithCache<Class>(
      "classes",
      async () => {
        const { data } = await supabase.from("classes").select("*").order("class_name");
        return data || [];
      }
    );

    setMaterials(matsData);
    setClasses(classesData);
    setLoading(false);

    if (fromCache) {
      toast.info("Showing cached data (offline mode)", { duration: 2000 });
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus materi "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus materi");
    } else {
      toast.success("Materi berhasil dihapus");
      fetchData();
    }
  };

  const topics = [...new Set(materials.map((m) => m.topic).filter(Boolean))];

  const filtered = materials.filter((m) => {
    const matchSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.topic || "").toLowerCase().includes(search.toLowerCase());
    const matchTopic = selectedTopic === "all" || m.topic === selectedTopic;
    return matchSearch && matchTopic;
  });

  const getFileTypeIcon = (fileUrl?: string) => {
    if (!fileUrl) return <File className="w-5 h-5" />;
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    if (["mp4", "mov", "avi", "webm"].includes(ext || "")) return <Video className="w-5 h-5" />;
    if (["pdf", "doc", "docx", "ppt", "pptx"].includes(ext || "")) return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const getFileTypeBg = (fileUrl?: string) => {
    if (!fileUrl) return "bg-gray-100 dark:bg-gray-800 text-gray-500";
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    if (["mp4", "mov", "avi", "webm"].includes(ext || "")) return "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400";
    if (["pdf"].includes(ext || "")) return "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400";
    if (["doc", "docx"].includes(ext || "")) return "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400";
    if (["ppt", "pptx"].includes(ext || "")) return "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400";
    return "bg-gray-100 dark:bg-gray-800 text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Materi Pelajaran</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} materi tersedia
          </p>
        </div>
        {user.role === "teacher" && (
          <Link href="/materials/upload">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Upload Materi
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari materi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {user.role === "teacher" && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {topics.length > 0 && (
          <Select value={selectedTopic} onValueChange={setSelectedTopic}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Semua Topik" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Topik</SelectItem>
              {topics.map((topic) => (
                <SelectItem key={topic} value={topic!}>{topic}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Materials List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Tidak ada materi ditemukan</p>
          {user.role === "teacher" && (
            <Link href="/materials/upload">
              <Button className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Upload Materi Pertama
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((mat) => (
            <div
              key={mat.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getFileTypeBg(mat.file_url)}`}>
                {getFileTypeIcon(mat.file_url)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white">{mat.title}</p>
                  {mat.topic && <Badge variant="outline" className="text-xs">{mat.topic}</Badge>}
                  {mat.meeting && <Badge variant="info" className="text-xs">Pertemuan {mat.meeting}</Badge>}
                </div>
                {mat.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{mat.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-400">{formatDate(mat.created_at)}</p>
                  {(mat.class as any)?.class_name && (
                    <Badge variant="secondary" className="text-xs">{(mat.class as any).class_name}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mat.file_url && (
                  <a href={mat.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </a>
                )}
                {user.role === "teacher" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(mat.id, mat.title)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
