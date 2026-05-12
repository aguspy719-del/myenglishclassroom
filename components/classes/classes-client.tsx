"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, BookOpen, ClipboardList, Loader2, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { User, Class } from "@/types";

interface ClassesClientProps {
  user: User;
}

export function ClassesClient({ user }: ClassesClientProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClass, setNewClass] = useState({ class_name: "", major: "", grade: "" });

  const fetchClasses = async () => {
    const supabase = createClient();
    let query = supabase.from("classes").select("*").order("class_name");

    if (user.role === "student" && user.class_id) {
      query = supabase.from("classes").select("*").eq("id", user.class_id);
    }

    const { data, error } = await query;
    if (!error) setClasses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async () => {
    if (!newClass.class_name || !newClass.major || !newClass.grade) {
      toast.error("Semua field harus diisi");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const { error } = await supabase.from("classes").insert([newClass]);

    if (error) {
      toast.error("Gagal membuat kelas: " + error.message);
    } else {
      toast.success("Kelas berhasil dibuat");
      setShowCreateDialog(false);
      setNewClass({ class_name: "", major: "", grade: "" });
      fetchClasses();
    }
    setCreating(false);
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(`Hapus kelas "${name}"? Semua data terkait akan ikut terhapus.`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus kelas");
    } else {
      toast.success("Kelas berhasil dihapus");
      fetchClasses();
    }
  };

  const filtered = classes.filter(
    (c) =>
      c.class_name.toLowerCase().includes(search.toLowerCase()) ||
      c.major.toLowerCase().includes(search.toLowerCase())
  );

  const gradeColors: Record<string, string> = {
    X: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    XI: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    XII: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.role === "teacher" ? "Kelola Kelas" : "Kelas Saya"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.role === "teacher"
              ? `${classes.length} kelas terdaftar`
              : "Kelas yang kamu ikuti"}
          </p>
        </div>
        {user.role === "teacher" && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Kelas
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari kelas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Tidak ada kelas ditemukan</p>
          {user.role === "teacher" && (
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Buat Kelas Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cls) => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className={gradeColors[cls.grade] || "bg-gray-100 text-gray-700"}>
                      Kelas {cls.grade}
                    </Badge>
                    <CardTitle className="text-lg mt-2">{cls.class_name}</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{cls.major}</p>
                  </div>
                  {user.role === "teacher" && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClass(cls.id, cls.class_name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Link href={`/materials?class=${cls.id}`}>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer">
                      <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Materi</p>
                    </div>
                  </Link>
                  <Link href={`/assignments?class=${cls.id}`}>
                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-950 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors cursor-pointer">
                      <ClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Tugas</p>
                    </div>
                  </Link>
                  <Link href={`/attendance?class=${cls.id}`}>
                    <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition-colors cursor-pointer">
                      <Users className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Absensi</p>
                    </div>
                  </Link>
                </div>
                <Link href={`/classes/${cls.id}`}>
                  <Button variant="outline" className="w-full text-sm" size="sm">
                    Lihat Detail Kelas
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Class Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kelas Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Kelas</Label>
              <Input
                placeholder="Contoh: X Busana 1"
                value={newClass.class_name}
                onChange={(e) => setNewClass({ ...newClass, class_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jurusan</Label>
              <Input
                placeholder="Contoh: Tata Busana"
                value={newClass.major}
                onChange={(e) => setNewClass({ ...newClass, major: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tingkat</Label>
              <Input
                placeholder="Contoh: X, XI, atau XII"
                value={newClass.grade}
                onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateClass} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Buat Kelas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
