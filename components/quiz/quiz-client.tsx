"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Clock, Users, Trash2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { User, Quiz, Class } from "@/types";

interface QuizClientProps {
  user: User;
}

export function QuizClient({ user }: QuizClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ class_id: "all", title: "", description: "", time_limit: "" });

  const fetchData = async () => {
    const supabase = createClient();

    let query = supabase
      .from("quizzes")
      .select("*, class:classes(class_name)")
      .order("created_at", { ascending: false });

    if (user.role === "student" && user.class_id) {
      query = query.eq("class_id", user.class_id);
    }

    const [quizzesRes, classesRes] = await Promise.all([
      query,
      supabase.from("classes").select("*").order("class_name"),
    ]);

    setQuizzes(quizzesRes.data || []);
    setClasses(classesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!form.title) {
      toast.error("Quiz title is required");
      return;
    }
    setCreating(true);
    const supabase = createClient();

    // If "all classes" selected, create a quiz for each class
    const classIds = form.class_id === "all"
      ? classes.map((c) => c.id)
      : [form.class_id];

    let successCount = 0;
    for (const classId of classIds) {
      const { error } = await supabase.from("quizzes").insert([{
        class_id: classId,
        title: form.title,
        description: form.description || null,
        time_limit: form.time_limit ? parseInt(form.time_limit) : null,
      }]);
      if (!error) successCount++;
    }

    if (successCount > 0) {
      toast.success(form.class_id === "all"
        ? `Quiz created for all ${successCount} classes`
        : "Quiz created successfully"
      );
      setShowCreate(false);
      setForm({ class_id: "all", title: "", description: "", time_limit: "" });
      fetchData();
    } else {
      toast.error("Failed to create quiz");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus kuis "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus kuis");
    else { toast.success("Kuis dihapus"); fetchData(); }
  };

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kuis / AKM</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} kuis tersedia</p>
        </div>
        {user.role === "teacher" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Buat Kuis
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari kuis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Belum ada kuis</p>
          {user.role === "teacher" && (
            <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Buat Kuis Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {user.role === "teacher" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{quiz.title}</h3>
                {quiz.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{quiz.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {(quiz.class as any)?.class_name && (
                    <Badge variant="secondary" className="text-xs">{(quiz.class as any).class_name}</Badge>
                  )}
                  {quiz.time_limit && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {quiz.time_limit} menit
                    </span>
                  )}
                </div>
                <Link href={`/quiz/${quiz.id}`}>
                  <Button className="w-full" size="sm">
                    {user.role === "teacher" ? "Kelola Kuis" : "Mulai Kuis"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Quiz Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Kuis Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger>
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
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  ✓ Quiz will be created for all {classes.length} classes
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Judul Kuis *</Label>
              <Input
                placeholder="Contoh: Kuis AKM - Hope and Plan"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea
                placeholder="Deskripsi kuis..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Batas Waktu (menit)</Label>
              <Input
                type="number"
                placeholder="Contoh: 30"
                min="1"
                value={form.time_limit}
                onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Menyimpan..." : "Buat Kuis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
