"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Users, BookOpen, ClipboardList, FileText,
  Plus, Download, Trash2, Clock, Search, GraduationCap,
  MoreVertical, Mail, FileQuestion, UserMinus, UserPlus, Loader2,
  Archive, ArchiveRestore,
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
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatDateTime, getDeadlineStatus, getInitials } from "@/lib/utils";
import { ClassGradesTab } from "@/components/classes/class-grades-tab";
import type { User, Class, Material, Assignment, Quiz } from "@/types";

interface ClassDetailClientProps {
  user: User;
  classData: Class;
}

interface StudentWithStats extends User {
  submission_count?: number;
  attendance_count?: number;
}

type MaterialWithArchive = Material & { is_archived?: boolean };
type AssignmentWithArchive = Assignment & { is_archived?: boolean };
type QuizWithArchive = Quiz & { is_archived?: boolean };

export function ClassDetailClient({ user, classData }: ClassDetailClientProps) {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [materials, setMaterials] = useState<MaterialWithArchive[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithArchive[]>([]);
  const [quizzes, setQuizzes] = useState<QuizWithArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Sub-tab states for archive views (teacher only)
  const [materialView, setMaterialView] = useState<"active" | "archived">("active");
  const [assignmentView, setAssignmentView] = useState<"active" | "closed" | "archived">("active");
  const [quizView, setQuizView] = useState<"active" | "archived">("active");

  // Student management
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ name: "", email: "", password: "" });
  const [creatingStudent, setCreatingStudent] = useState(false);

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

  // ── Archive helpers ────────────────────────────────────────

  const handleArchiveMaterial = async (id: string, title: string, archive: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from("materials").update({ is_archived: archive }).eq("id", id);
    if (error) toast.error(`Failed to ${archive ? "archive" : "restore"} material`);
    else { toast.success(`Material ${archive ? "archived" : "restored"}`); fetchData(); }
  };

  const handleArchiveAssignment = async (id: string, title: string, archive: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from("assignments").update({ is_archived: archive }).eq("id", id);
    if (error) toast.error(`Failed to ${archive ? "archive" : "restore"} assignment`);
    else { toast.success(`Assignment ${archive ? "archived" : "restored"}`); fetchData(); }
  };

  const handleArchiveQuiz = async (id: string, title: string, archive: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from("quizzes").update({ is_archived: archive }).eq("id", id);
    if (error) toast.error(`Failed to ${archive ? "archive" : "restore"} assessment`);
    else { toast.success(`Assessment ${archive ? "archived" : "restored"}`); fetchData(); }
  };

  // ── Delete helpers ─────────────────────────────────────────

  const handleDeleteMaterial = async (id: string, title: string) => {
    if (!confirm(`Permanently delete material "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) toast.error("Failed to delete material");
    else { toast.success("Material deleted"); fetchData(); }
  };

  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!confirm(`Permanently delete assignment "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) toast.error("Failed to delete assignment");
    else { toast.success("Assignment deleted"); fetchData(); }
  };

  const handleDeleteQuiz = async (id: string, title: string) => {
    if (!confirm(`Permanently delete assessment "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) toast.error("Failed to delete assessment");
    else { toast.success("Assessment deleted"); fetchData(); }
  };

  // ── Student helpers ────────────────────────────────────────

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Remove "${studentName}" from this class? Their account will not be deleted.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ class_id: null }).eq("id", studentId);
    if (error) toast.error("Failed to remove student");
    else { toast.success(`${studentName} removed from class`); fetchData(); }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Permanently delete account "${studentName}"? This cannot be undone and will remove all their data.`)) return;
    const res = await fetch("/api/admin/delete-student", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to delete student");
    } else {
      toast.success(`${studentName} deleted`);
      fetchData();
    }
  };

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

  const handleCreateStudent = async () => {
    if (!newStudentForm.name || !newStudentForm.email || !newStudentForm.password) {
      toast.error("All fields are required");
      return;
    }
    setCreatingStudent(true);
    try {
      const res = await fetch("/api/admin/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStudentForm.name,
          email: newStudentForm.email,
          password: newStudentForm.password,
          class_id: classData.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create account");
      } else {
        toast.success(`Account created for ${newStudentForm.name}! 🎉`);
        setNewStudentForm({ name: "", email: "", password: "" });
        setShowCreateStudent(false);
        fetchData();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreatingStudent(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  // Active = not archived
  const activeMaterials = materials.filter((m) => !m.is_archived);
  const archivedMaterials = materials.filter((m) => m.is_archived);

  const activeAssignments = assignments.filter(
    (a) => !a.is_archived && getDeadlineStatus(a.deadline) !== "overdue"
  );
  const overdueAssignments = assignments.filter(
    (a) => !a.is_archived && getDeadlineStatus(a.deadline) === "overdue"
  );
  const archivedAssignments = assignments.filter((a) => a.is_archived);

  const activeQuizzes = quizzes.filter((q) => !q.is_archived);
  const archivedQuizzes = quizzes.filter((q) => q.is_archived);

  // For students: only show non-archived items
  const studentMaterials = activeMaterials;
  const studentAssignmentsActive = activeAssignments;
  const studentQuizzes = activeQuizzes;

  const getFileTypeBg = (fileUrl?: string) => {
    if (!fileUrl) return "bg-gray-100 dark:bg-gray-800 text-gray-500";
    const ext = fileUrl.split(".").pop()?.toLowerCase();
    if (["mp4", "mov", "avi"].includes(ext || "")) return "bg-red-100 dark:bg-red-900 text-red-600";
    if (ext === "pdf") return "bg-orange-100 dark:bg-orange-900 text-orange-600";
    if (["doc", "docx"].includes(ext || "")) return "bg-blue-100 dark:bg-blue-900 text-blue-600";
    return "bg-gray-100 dark:bg-gray-800 text-gray-500";
  };

  const BANNER_COLORS = [
    "from-blue-500 to-blue-700",
    "from-indigo-500 to-indigo-700",
    "from-purple-500 to-purple-700",
    "from-green-500 to-green-700",
    "from-teal-500 to-teal-700",
    "from-orange-500 to-orange-700",
  ];
  const bannerColor = BANNER_COLORS[classData.class_name.charCodeAt(0) % BANNER_COLORS.length];

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

  // ── Archive toggle button (reusable) ──────────────────────
  const ArchiveToggleButton = ({
    isArchived,
    onArchive,
    onRestore,
  }: {
    isArchived: boolean;
    onArchive: () => void;
    onRestore: () => void;
  }) =>
    isArchived ? (
      <Button
        variant="ghost"
        size="icon"
        title="Restore"
        className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
        onClick={onRestore}
      >
        <ArchiveRestore className="w-4 h-4" />
      </Button>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        title="Archive"
        className="h-8 w-8 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        onClick={onArchive}
      >
        <Archive className="w-4 h-4" />
      </Button>
    );

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
              <span className="text-sm font-semibold">{activeMaterials.length} Materials</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{activeAssignments.length + overdueAssignments.length} Assignments</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FileQuestion className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold">{activeQuizzes.length} Assessments</span>
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); }}>
        <TabsList className={`w-full grid h-auto ${user.role === "teacher" ? "grid-cols-6" : "grid-cols-5"}`}>
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">
            Materials
            {activeMaterials.length > 0 && <span className="ml-1 text-[10px] opacity-70">({activeMaterials.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="text-xs">
            Assignments
            {(activeAssignments.length + overdueAssignments.length) > 0 && (
              <span className="ml-1 text-[10px] opacity-70">({activeAssignments.length + overdueAssignments.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="assessments" className="text-xs">
            Assessment
            {activeQuizzes.length > 0 && <span className="ml-1 text-[10px] opacity-70">({activeQuizzes.length})</span>}
          </TabsTrigger>
          {user.role === "teacher" && (
            <TabsTrigger value="grades" className="text-xs">
              Grades
            </TabsTrigger>
          )}
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
              ) : activeMaterials.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No materials yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMaterials.slice(0, 5).map((m) => (
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
                  {activeMaterials.length > 5 && (
                    <button
                      onClick={() => setActiveTab("materials")}
                      className="w-full text-center text-xs text-blue-600 dark:text-blue-400 py-2 hover:underline"
                    >
                      View all {activeMaterials.length} materials →
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
                  Assessments ({activeQuizzes.length})
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
              ) : activeQuizzes.length === 0 ? (
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
                  {activeQuizzes.slice(0, 3).map((q) => {
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

          {/* Teacher: Active / Archived sub-tabs */}
          {user.role === "teacher" && (
            <div className="flex gap-2">
              <button
                onClick={() => setMaterialView("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  materialView === "active"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Active
                <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {activeMaterials.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
              <button
                onClick={() => setMaterialView("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  materialView === "archived"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archived
                <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {archivedMaterials.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
            </div>
          )}

          {/* Materials list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (() => {
            const displayList = user.role === "teacher"
              ? (materialView === "active" ? activeMaterials : archivedMaterials)
              : studentMaterials;
            const filtered = displayList.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()));

            if (filtered.length === 0) return (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {materialView === "archived" ? "No archived materials" : "No materials found"}
                </p>
                {user.role === "teacher" && materialView === "active" && (
                  <Link href={`/materials/upload?class=${classData.id}`}>
                    <Button className="mt-4 gap-2 rounded-xl" size="sm">
                      <Plus className="w-4 h-4" />Upload First Material
                    </Button>
                  </Link>
                )}
              </div>
            );

            return (
              <div className="space-y-2">
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm group hover:shadow-md transition-all ${m.is_archived ? "opacity-70" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getFileTypeBg(m.file_url)}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{m.title}</p>
                        {m.is_archived && <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1"><Archive className="w-2.5 h-2.5" />Archived</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.topic && <Badge variant="outline" className="text-xs">{m.topic}</Badge>}
                        {m.meeting && <Badge variant="secondary" className="text-xs">Meeting {m.meeting}</Badge>}
                        <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 text-xs">
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </a>
                      )}
                      {user.role === "teacher" && (
                        <>
                          <ArchiveToggleButton
                            isArchived={!!m.is_archived}
                            onArchive={() => handleArchiveMaterial(m.id, m.title, true)}
                            onRestore={() => handleArchiveMaterial(m.id, m.title, false)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteMaterial(m.id, m.title)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        {/* ── Assignments Tab ── */}
        <TabsContent value="assignments" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search assignments..."
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {user.role === "teacher" && (
              <Link href={`/assignments/create?class=${classData.id}`}>
                <Button size="sm" className="gap-2 rounded-xl flex-shrink-0">
                  <Plus className="w-4 h-4" />Create
                </Button>
              </Link>
            )}
          </div>

          {/* Teacher: Active / Archived sub-tabs */}
          {user.role === "teacher" && (
            <div className="flex gap-2">
              <button
                onClick={() => setAssignmentView("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  assignmentView === "active"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Active
                <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {activeAssignments.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
              <button
                onClick={() => setAssignmentView("closed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  assignmentView === "closed"
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Closed
                <span className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {overdueAssignments.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
              <button
                onClick={() => setAssignmentView("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  assignmentView === "archived"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archived
                <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {archivedAssignments.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (() => {
            let displayList: AssignmentWithArchive[];
            if (user.role === "teacher") {
              if (assignmentView === "archived") {
                displayList = archivedAssignments;
              } else if (assignmentView === "closed") {
                displayList = overdueAssignments;
              } else {
                displayList = activeAssignments;
              }
            } else {
              displayList = [...activeAssignments, ...overdueAssignments];
            }
            const filtered = displayList.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()));

            if (filtered.length === 0) return (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {assignmentView === "archived" ? "No archived assignments" : assignmentView === "closed" ? "No closed assignments" : "No active assignments"}
                </p>
                {user.role === "teacher" && assignmentView === "active" && (
                  <Link href={`/assignments/create?class=${classData.id}`}>
                    <Button className="mt-4 gap-2 rounded-xl" size="sm">
                      <Plus className="w-4 h-4" />Create First Assignment
                    </Button>
                  </Link>
                )}
              </div>
            );

            return (
              <div className="space-y-2">
                {filtered.map((a) => {
                  const status = getDeadlineStatus(a.deadline);
                  const isClosed = status === "overdue";
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group ${a.is_archived ? "opacity-70" : ""}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isClosed ? "bg-red-100 dark:bg-red-900" : "bg-blue-100 dark:bg-blue-900"}`}>
                        <ClipboardList className={`w-5 h-5 ${isClosed ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{a.title}</p>
                          {a.is_archived && (
                            <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1">
                              <Archive className="w-2.5 h-2.5" />Archived
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{formatDateTime(a.deadline)}
                          </span>
                          <Badge
                            variant={isClosed ? "destructive" : status === "today" ? "warning" : "success"}
                            className="text-[10px]"
                          >
                            {isClosed ? "Closed" : status === "today" ? "Due Today" : "Active"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!a.is_archived && (
                          <Link href={`/assignments/${a.id}`}>
                            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs">
                              {user.role === "teacher" ? "View" : isClosed ? "View" : "Submit"}
                            </Button>
                          </Link>
                        )}
                        {user.role === "teacher" && (
                          <>
                            <ArchiveToggleButton
                              isArchived={!!a.is_archived}
                              onArchive={() => handleArchiveAssignment(a.id, a.title, true)}
                              onRestore={() => handleArchiveAssignment(a.id, a.title, false)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteAssignment(a.id, a.title)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

          {/* Teacher: Active / Archived sub-tabs */}
          {user.role === "teacher" && (
            <div className="flex gap-2">
              <button
                onClick={() => setQuizView("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  quizView === "active"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Active
                <span className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {activeQuizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
              <button
                onClick={() => setQuizView("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  quizView === "archived"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archived
                <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full px-1.5 py-0.5 text-[10px]">
                  {archivedQuizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase())).length}
                </span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (() => {
            const displayList = user.role === "teacher"
              ? (quizView === "active" ? activeQuizzes : archivedQuizzes)
              : studentQuizzes;
            const filtered = displayList.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

            if (filtered.length === 0) return (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <FileQuestion className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {quizView === "archived" ? "No archived assessments" : "No assessments yet"}
                </p>
                {user.role === "teacher" && quizView === "active" && (
                  <Link href="/quiz">
                    <Button className="mt-4 gap-2 rounded-xl" size="sm">
                      <Plus className="w-4 h-4" />Create First Assessment
                    </Button>
                  </Link>
                )}
              </div>
            );

            return (
              <div className="space-y-2">
                {filtered.map((q) => {
                  const quizType = q.quiz_type || "formatif";
                  const isScheduled = q.published_at && new Date(q.published_at) > new Date();
                  return (
                    <div
                      key={q.id}
                      className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group ${q.is_archived ? "opacity-70" : ""}`}
                    >
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileQuestion className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{q.title}</p>
                          {q.is_archived && <Badge variant="secondary" className="text-[10px] flex-shrink-0 gap-1"><Archive className="w-2.5 h-2.5" />Archived</Badge>}
                        </div>
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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!q.is_archived && (
                          <Link href={`/quiz/${q.id}`}>
                            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs">
                              {user.role === "teacher" ? "Manage" : "Start"}
                            </Button>
                          </Link>
                        )}
                        {user.role === "teacher" && (
                          <>
                            <ArchiveToggleButton
                              isArchived={!!q.is_archived}
                              onArchive={() => handleArchiveQuiz(q.id, q.title, true)}
                              onRestore={() => handleArchiveQuiz(q.id, q.title, false)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteQuiz(q.id, q.title)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        {/* ── Grades Tab (Teacher only) ── */}
        {user.role === "teacher" && (
          <TabsContent value="grades" className="mt-0">
            <ClassGradesTab classData={classData} />
          </TabsContent>
        )}

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
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => { setShowAddStudent(true); loadAvailableStudents(); }}
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </Button>
                <Button
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => setShowCreateStudent(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </div>
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

      {/* Create Student Account Dialog */}
      <Dialog open={showCreateStudent} onOpenChange={setShowCreateStudent}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create Student Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              📌 Account will be created for <strong>{classData.class_name}</strong>. Share the email & password with the student.
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Budi Santoso"
                value={newStudentForm.name}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="student@email.com"
                value={newStudentForm.email}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="text"
                placeholder="Minimum 6 characters"
                value={newStudentForm.password}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                className="rounded-xl font-mono"
              />
              <p className="text-xs text-gray-500">Share this password with the student. They can change it later in Profile.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowCreateStudent(false); setNewStudentForm({ name: "", email: "", password: "" }); }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateStudent} disabled={creatingStudent} className="rounded-xl">
              {creatingStudent ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
