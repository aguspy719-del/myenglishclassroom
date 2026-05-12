"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Clock, CheckCircle, AlertCircle, ClipboardList, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, getDeadlineStatus } from "@/lib/utils";
import type { User, Assignment, Class } from "@/types";

interface AssignmentsClientProps {
  user: User;
}

export function AssignmentsClient({ user }: AssignmentsClientProps) {
  const searchParams = useSearchParams();
  const classFilter = searchParams.get("class") || "all";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState(classFilter);
  const [filter, setFilter] = useState<"all" | "active" | "past">("all");

  const fetchData = async () => {
    const supabase = createClient();

    let query = supabase
      .from("assignments")
      .select("*, class:classes(class_name)")
      .order("deadline", { ascending: true });

    if (user.role === "student" && user.class_id) {
      query = query.eq("class_id", user.class_id);
    } else if (selectedClass !== "all") {
      query = query.eq("class_id", selectedClass);
    }

    const [assignsRes, classesRes] = await Promise.all([
      query,
      supabase.from("classes").select("*").order("class_name"),
    ]);

    setAssignments(assignsRes.data || []);
    setClasses(classesRes.data || []);

    // For students, check which assignments they've submitted
    if (user.role === "student" && assignsRes.data) {
      const { data: subs } = await supabase
        .from("submissions")
        .select("assignment_id")
        .eq("student_id", user.id);

      const submittedMap: Record<string, boolean> = {};
      subs?.forEach((s) => { submittedMap[s.assignment_id] = true; });
      setSubmissions(submittedMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus tugas "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus tugas");
    } else {
      toast.success("Tugas berhasil dihapus");
      fetchData();
    }
  };

  const filtered = assignments.filter((a) => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const isPast = new Date(a.deadline) < new Date();
    const matchFilter =
      filter === "all" ||
      (filter === "active" && !isPast) ||
      (filter === "past" && isPast);
    return matchSearch && matchFilter;
  });

  const getStatusBadge = (assignment: Assignment) => {
    const status = getDeadlineStatus(assignment.deadline);
    if (user.role === "student") {
      if (submissions[assignment.id]) {
        return <Badge variant="success">Sudah Dikumpulkan</Badge>;
      }
      if (status === "overdue") return <Badge variant="destructive">Lewat Deadline</Badge>;
      if (status === "today") return <Badge variant="warning">Hari Ini</Badge>;
      return <Badge variant="info">Belum Dikumpulkan</Badge>;
    }
    if (status === "overdue") return <Badge variant="destructive">Selesai</Badge>;
    if (status === "today") return <Badge variant="warning">Hari Ini</Badge>;
    return <Badge variant="success">Aktif</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.role === "teacher" ? "Kelola Tugas" : "Tugas Saya"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} tugas</p>
        </div>
        {user.role === "teacher" && (
          <Link href="/assignments/create">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Tugas
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari tugas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {user.role === "teacher" && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-44">
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
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="past">Selesai</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignments */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Tidak ada tugas</p>
          {user.role === "teacher" && (
            <Link href="/assignments/create">
              <Button className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Buat Tugas Pertama
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((assignment) => {
            const isPast = new Date(assignment.deadline) < new Date();
            const isToday = getDeadlineStatus(assignment.deadline) === "today";

            return (
              <div
                key={assignment.id}
                className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border transition-shadow hover:shadow-sm group ${
                  isToday
                    ? "border-orange-300 dark:border-orange-700"
                    : isPast
                    ? "border-gray-200 dark:border-gray-700 opacity-75"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isPast
                    ? "bg-gray-100 dark:bg-gray-700"
                    : isToday
                    ? "bg-orange-100 dark:bg-orange-900"
                    : "bg-blue-100 dark:bg-blue-900"
                }`}>
                  {isPast ? (
                    <CheckCircle className="w-6 h-6 text-gray-500" />
                  ) : isToday ? (
                    <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{assignment.title}</p>
                    {getStatusBadge(assignment)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Deadline: {formatDate(assignment.deadline)}
                    </p>
                    {(assignment.class as any)?.class_name && (
                      <Badge variant="secondary" className="text-xs">
                        {(assignment.class as any).class_name}
                      </Badge>
                    )}
                  </div>
                  {assignment.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {assignment.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/assignments/${assignment.id}`}>
                    <Button variant="outline" size="sm">
                      {user.role === "teacher" ? "Lihat" : "Kerjakan"}
                    </Button>
                  </Link>
                  {user.role === "teacher" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(assignment.id, assignment.title)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
