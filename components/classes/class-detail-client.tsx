"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, BookOpen, ClipboardList, FileText,
  Plus, Download, Trash2, Clock, Search, GraduationCap,
  MoreVertical, Mail, FileQuestion, UserMinus, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatDateTime, getDeadlineStatus, getInitials } from "@/lib/utils";
import type { User, Class, Material, Assignment, Quiz } from "@/types";

interface ClassDetailClientProps {
  user: User;
  classData: Class;
}

interface StudentWithStats extends User {
  submission_count?: number;
  attendance_count?: number;
}

export function ClassDetailClient({ user, classData }: ClassDetailClientProps) {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  // Student management
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const fetchData = async () => {
    const supabase = createClient();
    setLoading(true);

    const [studentsRes, materialsRes, assignmentsRes, quizzesRes] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .eq("class_id", classData.id)
        .eq("role", "student")
        .order("name"),
      supabase
        .from("materials")
        .select("*")
        .eq("class_id", classData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("assignments")
        .select("*")
        .eq("class_id", classData.id)
        .order("deadline", { ascending: true }),
      supabase
        .from("quizzes")
        .select("*")
        .eq("class_id", classData.id)
        .order("created_at", { ascending: false }),
    ]);

    setStudents(studentsRes.data || []);
    setMaterials(materialsRes.data || []);
    setAssignments(assignmentsRes.data || []);
    setQuizzes(quizzesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [classData.id]);

  const handleDeleteMaterial = async (id: string, title: string) => {
    if (!confirm(`Delete material "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) toast.error("Failed to delete material");
    else { toast.success("Material deleted"); fetchData(); }
  };

  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!confirm(`Delete assignment "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) toast.error("Failed to delete assignment");
    else { toast.success("Assignment deleted"); fetchData(); }
  };

  // Remove student from class (set class_id to null)
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Remove "${studentName}" from this class? Their account will not be deleted.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ class_id: null }).eq("id", studentId);
    if (error) toast.error("Failed to remove student");
    else { toast.success(`${studentName} removed from class`); fetchData(); }
  };

  // Delete student account entirely
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Permanently delete account "${studentName}"? This cannot be undone.`)) return;
    const supabase = createClient();
    // Delete from auth via admin — we can only delete from users table (auth deletion needs service key)
    const { error } = await supabase.from("users").delete().eq("id", studentId);
    if (error) toast.error("Failed to delete student");
    else { toast.success(`${studentName} deleted`); fetchData(); }
  };

  // Load students not in any class or in other classes
  const loadAvailableStudents = async () => {
    setLoadingAvailable(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("role", "student")
      .neq("class_id", classData.id)
      .order("name");
    setAvailableStudents(data || []);
    setLoadingAvailable(false);
  };

  // Add student to this class
  const handleAddStudent = async (studentId: string, studentName: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ class_id: classData.id }).eq("id", studentId);
    if (error) toast.error("Failed to add student");
    else {
      toast.success(`${studentName} added to class`);
      setAvailableStudents((p) => p.filter((s) => s.id !== studentId));
      fetchData();
    }
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeAssignments = assignments.filter(
    (a) => getDeadlineStatus(a.deadline) !== "overdue"
  );
  const overdueAssignments = assignments.filter(
    (a) => getDeadlineStatus(a.deadline) === "overdue"
  );

  const getFileTypeBg = (fileUrl?: string) => {
    if (!fileUrl) return "bg-gray-100 dark:bg-gray-800 text-gray-500";
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    if (["mp4", "mov", "avi"].includes(ext || "")) return "bg-red-100 dark:bg-red-900 text-red-600";
    if (ext === "pdf") return "bg-orange-100 dark:bg-orange-900 text-orange-600";
    if (["doc", "docx"].includes(ext || "")) return "bg-blue-100 dark:bg-blue-900 text-blue-600";
    return "bg-gray-100 dark:bg-gray-800 text-gray-500";
  };

  // Banner color based on class name
  const BANNER_COLORS = [
    "from-blue-500 to-blue-700",
    "from-indigo-500 to-indigo-700",
    "from-purple-500 to-purple-700",
    "from-green-500 to-green-700",
    "from-teal-500 to-teal-700",
    "from-orange-500 to-orange-700",
  ];
  const bannerColor = BANNER_COLORS[classData.class_name.charCodeAt(0) % BANNER_COLORS.length];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/classes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {classData.class_name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {classData.major} · Grade {classData.grade}
          </p>
        </div>
      </div>

      {/* Banner Card */}
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${bannerColor} p-6 text-white`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-10 -translate-x-10" />
        <div className="relative">
          <Badge className="bg-white/20 text-white border-white/30 mb-3">
            Grade {classData.grade}
          </Badge>
          <h2 className="text-2xl font-bold">{classData.class_name}</h2>
          <p className="text-white/80 mt-1">{classData.major}</p>
          {(classData as any).class_code && (
            <div className="mt-2 inline-flex items-center gap-2 bg-white/20 rounded-xl px-3 py-1.5">
              <span className="text-white/70 text-xs">Class Code:</span>
              <span className="text-white font-bold font-mono text-sm tracking-widest">{(classData as any).class_code}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Users className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{students.length} Students</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <BookOpen className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{materials.length} Materials</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{assignments.length} Assignments</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FileQuestion className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{quizzes.length} Assessments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions (Teacher only) */}
      {user.role === "teacher" && (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/materials/upload?class=${classData.id}`}>
            <Button variant="outline" className="w-full gap-2 rounded-xl h-11">
              <BookOpen className="w-4 h-4" />
              Upload Material
            </Button>
          </Link>
          <Link href={`/assignments/create?class=${classData.id}`}>
            <Button variant="outline" className="w-full gap-2 rounded-xl h-11">
              <ClipboardList className="w-4 h-4" />
              Create Assignment
            </Button>
          </Link>
          <Link href={`/quiz?class=${classData.id}`}>
            <Button variant="outline" className="w-full gap-2 rounded-xl h-11">
              <FileQuestion className="w-4 h-4" />
              Create Assessment
            </Button>
          </Link>
          <Link href={`/attendance?class=${classData.id}`}>
            <Button variant="outline" className="w-full gap-2 rounded-xl h-11">
              <Users className="w-4 h-4" />
              Take Attendance
            </Button>
          </Link>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">
            Materials
            {materials.length > 0 && <span className="ml-1 text-[10px] opacity-70">({materials.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="assessments" className="text-xs">
            Assessment
            {quizzes.length > 0 && <span className="ml-1 text-[10px] opacity-70">({quizzes.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="students" className="text-xs">
            Students
            {students.length > 0 && <span className="ml-1 text-[10px] opacity-70">({students.length})</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Active Assignments */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  Active Assignments ({activeAssignments.length})
                </CardTitle>
                {user.role === "teacher" && (
                  <Link href={`/assignments/create?class=${classData.id}`}>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs rounded-xl">
                      <Plus className="w-3.5 h-3.5" />Add
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : activeAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No active assignments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeAssignments.map((a) => {
                    const status = getDeadlineStatus(a.deadline);
                    return (
                      <Link key={a.id} href={`/assignments/${a.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{a.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">{formatDateTime(a.deadline)}</p>
                            </div>
                          </div>
                          <Badge
                            variant={status === "today" ? "warning" : "success"}
                            className="text-xs flex-shrink-0"
                          >
                            {status === "today" ? "Due Today" : "Active"}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Materials */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-green-600" />
                  Recent Materials
                </CardTitle>
                {user.role === "teacher" && (
                  <Link href={`/materials/upload?class=${classData.id}`}>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs rounded-xl">
                      <Plus className="w-3.5 h-3.5" />Add
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : materials.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No materials yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getFileTypeBg(m.file_url)}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{m.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(m.created_at)}</p>
                      </div>
                      {m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                  {materials.length > 5 && (
                    <button
                      onClick={() => setActiveTab("materials")}
                      className="w-full text-center text-xs text-blue-600 dark:text-blue-400 py-2 hover:underline"
                    >
                      View all {materials.length} materials →
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Assessments */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-purple-600" />
                  Assessments ({quizzes.length})
                </CardTitle>
                <button
                  onClick={() => setActiveTab("assessments")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View all →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                </div>
              ) : quizzes.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                  <FileQuestion className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No assessments yet</p>
                  {user.role === "teacher" && (
                    <Link href="/quiz">
                      <Button size="sm" variant="ghost" className="mt-2 gap-1 text-xs rounded-xl">
                        <Plus className="w-3.5 h-3.5" />Create Assessment
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {quizzes.slice(0, 3).map((q) => {
                    const typeLabels: Record<string, string> = {
                      formatif: "Formatif",
                      sumatif_tengah: "STS",
                      sumatif_akhir: "SAS",
                    };
                    const typeColors: Record<string, string> = {
                      formatif: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      sumatif_tengah: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                      sumatif_akhir: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                    };
                    const quizType = q.quiz_type || "formatif";
                    return (
                      <Link key={q.id} href={`/quiz/${q.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileQuestion className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{q.title}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColors[quizType]}`}>
                            {typeLabels[quizType]}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overdue Assignments */}
          {overdueAssignments.length > 0 && user.role === "teacher" && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-600 dark:text-red-400">
                  Closed Assignments ({overdueAssignments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueAssignments.slice(0, 3).map((a) => (
                    <Link key={a.id} href={`/assignments/${a.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{a.title}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(a.deadline)}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs flex-shrink-0">Closed</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Materials Tab ── */}
        <TabsContent value="materials" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search materials..."
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {user.role === "teacher" && (
              <Link href={`/materials/upload?class=${classData.id}`}>
                <Button size="sm" className="gap-2 rounded-xl flex-shrink-0">
                  <Plus className="w-4 h-4" />Upload
                </Button>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : materials.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No materials found</p>
              {user.role === "teacher" && (
                <Link href={`/materials/upload?class=${classData.id}`}>
                  <Button className="mt-4 gap-2 rounded-xl" size="sm">
                    <Plus className="w-4 h-4" />Upload First Material
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {materials
                .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm group hover:shadow-md transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getFileTypeBg(m.file_url)}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.topic && <Badge variant="outline" className="text-xs">{m.topic}</Badge>}
                        {m.meeting && <Badge variant="secondary" className="text-xs">Meeting {m.meeting}</Badge>}
                        <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 text-xs">
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </a>
                      )}
                      {user.role === "teacher" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteMaterial(m.id, m.title)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>

        {/* ── Assessment Tab ── */}
        <TabsContent value="assessments" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search assessments..."
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {user.role === "teacher" && (
              <Link href="/quiz">
                <Button size="sm" className="gap-2 rounded-xl flex-shrink-0">
                  <Plus className="w-4 h-4" />Create
                </Button>
              </Link>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FileQuestion className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No assessments yet</p>
              {user.role === "teacher" && (
                <Link href="/quiz">
                  <Button className="mt-4 gap-2 rounded-xl" size="sm">
                    <Plus className="w-4 h-4" />Create First Assessment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {quizzes
                .filter((q) => q.title.toLowerCase().includes(search.toLowerCase()))
                .map((q) => {
                  const quizType = q.quiz_type || "formatif";
                  const isScheduled = q.published_at && new Date(q.published_at) > new Date();
                  const typeColors: Record<string, string> = {
                    formatif: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                    sumatif_tengah: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                    sumatif_akhir: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                  };
                  const typeLabels: Record<string, string> = {
                    formatif: "Formatif",
                    sumatif_tengah: "STS",
                    sumatif_akhir: "SAS",
                  };
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileQuestion className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{q.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[quizType]}`}>
                            {typeLabels[quizType]}
                          </span>
                          {q.time_limit && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{q.time_limit} min
                            </span>
                          )}
                          {isScheduled && (
                            <span className="text-xs text-orange-600 dark:text-orange-400">⏰ Scheduled</span>
                          )}
                          <span className="text-xs text-gray-400">{formatDate(q.created_at)}</span>
                        </div>
                      </div>
                      <Link href={`/quiz/${q.id}`} className="flex-shrink-0">
                        <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs">
                          {user.role === "teacher" ? "Manage" : "Start"}
                        </Button>
                      </Link>
                    </div>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* ── Students Tab ── */}
        <TabsContent value="students" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {user.role === "teacher" && (
              <Button
                size="sm"
                className="gap-2 rounded-xl flex-shrink-0"
                onClick={() => { setShowAddStudent(true); loadAvailableStudents(); }}
              >
                <UserPlus className="w-4 h-4" />Add
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No students found</p>
              <p className="text-sm mt-1">Students will appear here once they register and join this class</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student, idx) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    {student.avatar_url ? (
                      <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-bold">{getInitials(student.name)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{student.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">#{idx + 1}</span>
                    {user.role === "teacher" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${student.email}`} className="gap-2">
                              <Mail className="w-4 h-4" />Send Email
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/grades?student=${student.id}`} className="gap-2">
                              <GraduationCap className="w-4 h-4" />View Grades
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-yellow-600 dark:text-yellow-400"
                            onClick={() => handleRemoveStudent(student.id, student.name)}
                          >
                            <UserMinus className="w-4 h-4" />Remove from Class
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 text-red-600 dark:text-red-400"
                            onClick={() => handleDeleteStudent(student.id, student.name)}
                          >
                            <Trash2 className="w-4 h-4" />Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {students.length > 0 && (
            <Card className="border-0 shadow-sm bg-gray-50 dark:bg-gray-800/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Students</span>
                  <span className="font-bold text-gray-900 dark:text-white">{students.length}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Student to {classData.class_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {loadingAvailable ? (
              <div className="space-y-2">
                {[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            ) : availableStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No available students</p>
                <p className="text-xs mt-1">All registered students are already in a class</p>
              </div>
            ) : (
              availableStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{getInitials(s.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                    {s.class_id && <p className="text-xs text-orange-500">Currently in another class</p>}
                  </div>
                  <Button
                    size="sm"
                    className="gap-1 rounded-xl flex-shrink-0"
                    onClick={() => handleAddStudent(s.id, s.name)}
                  >
                    <UserPlus className="w-3.5 h-3.5" />Add
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudent(false)} className="rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
