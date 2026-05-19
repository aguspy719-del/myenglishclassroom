"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, ClipboardList, Users, Plus,
  MoreVertical, Download, Trash2, Clock, CheckCircle,
  AlertCircle, Send, Pin, Bell, FileText,
  GraduationCap, Star, UserCheck, Loader2, Lock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatRelativeTime, getInitials, getDeadlineStatus } from "@/lib/utils";
import { toast } from "sonner";
import { LockedMaterialBadge } from "@/components/materials/locked-material";
import type { User, Class, Material, Assignment } from "@/types";

interface ClassDetailClientProps {
  user: User;
  classData: Class;
}

const BANNER_COLORS = [
  "from-blue-500 to-blue-700",
  "from-indigo-500 to-indigo-700",
  "from-purple-500 to-purple-700",
  "from-green-500 to-green-700",
  "from-teal-500 to-teal-700",
  "from-orange-500 to-orange-700",
];
const getBannerColor = (name: string) => BANNER_COLORS[name.charCodeAt(0) % BANNER_COLORS.length];

interface Announcement {
  id: string;
  class_id: string;
  author_id: string;
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  pinned: boolean;
  created_at: string;
  author?: User;
}

export function ClassDetailClient({ user, classData }: ClassDetailClientProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [activeTab, setActiveTab] = useState("stream");
  const [unlockedMaterials, setUnlockedMaterials] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const supabase = createClient();
    const [matsRes, assignsRes, studentsRes, announcementsRes] = await Promise.all([
      supabase.from("materials").select("*").eq("class_id", classData.id).order("created_at", { ascending: false }),
      supabase.from("assignments").select("*").eq("class_id", classData.id).order("deadline", { ascending: true }),
      supabase.from("users").select("*").eq("class_id", classData.id).eq("role", "student").order("name"),
      supabase.from("class_announcements")
        .select("*, author:users(name, email, role)")
        .eq("class_id", classData.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setMaterials(matsRes.data || []);
    setAssignments(assignsRes.data || []);
    setStudents(studentsRes.data || []);
    setAnnouncements(announcementsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [classData.id]);

  // Learning paths: check which materials are unlocked for student
  useEffect(() => {
    if (user.role !== "student") return;
    const checkUnlocked = async () => {
      const supabase = createClient();
      // Get all quiz attempts by this student with passing score
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score")
        .eq("student_id", user.id)
        .not("score", "is", null);

      const passedQuizIds = new Set(
        (attempts || [])
          .filter((a) => (a.score || 0) >= 75)
          .map((a) => a.quiz_id)
      );

      // Check each material's prerequisite
      const unlocked = new Set<string>();
      materials.forEach((mat) => {
        const prereqId = (mat as any).prerequisite_quiz_id;
        if (!prereqId || passedQuizIds.has(prereqId)) {
          unlocked.add(mat.id);
        }
      });
      setUnlockedMaterials(unlocked);
    };
    if (materials.length > 0) checkUnlocked();
  }, [materials, user.id, user.role]);

  const handlePost = async () => {
    if (!postContent.trim()) return;
    setPosting(true);
    const supabase = createClient();
    const { error } = await supabase.from("class_announcements").insert([{
      class_id: classData.id,
      author_id: user.id,
      content: postContent.trim(),
      pinned: false,
    }]);
    if (error) toast.error("Failed to post");
    else {
      toast.success("Posted to stream!");
      setPostContent("");
      fetchData();
    }
    setPosting(false);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const supabase = createClient();
    await supabase.from("class_announcements").delete().eq("id", id);
    fetchData();
  };

  const handlePinAnnouncement = async (id: string, pinned: boolean) => {
    const supabase = createClient();
    await supabase.from("class_announcements").update({ pinned: !pinned }).eq("id", id);
    fetchData();
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    const supabase = createClient();
    await supabase.from("materials").delete().eq("id", id);
    fetchData();
    toast.success("Material deleted");
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("Delete this assignment?")) return;
    const supabase = createClient();
    await supabase.from("assignments").delete().eq("id", id);
    fetchData();
    toast.success("Assignment deleted");
  };

  const bannerColor = getBannerColor(classData.class_name);
  const activeAssignments = assignments.filter((a) => new Date(a.deadline) >= new Date()).length;

  return (
    <div className="space-y-0 -mt-4 md:-mt-6">
      {/* Class Banner — Google Classroom style */}
      <div className={`relative bg-gradient-to-br ${bannerColor} rounded-2xl overflow-hidden mb-6`}>
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-12 -translate-x-12" />

        <div className="relative p-6 pb-8">
          <Link href="/classes">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 gap-2 mb-4 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
              All Classes
            </Button>
          </Link>

          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <Badge className="bg-white/20 text-white border-white/30 mb-2">Grade {classData.grade}</Badge>
              <h1 className="text-3xl font-bold text-white">{classData.class_name}</h1>
              <p className="text-white/80 mt-1">{classData.major} · SMK Negeri 1 Buduran</p>
              <p className="text-white/60 text-sm mt-1">
                {students.length} students · {materials.length} materials · {activeAssignments} active tasks
              </p>
            </div>
            {user.role === "teacher" && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
                  <p className="text-white/70 text-xs">Class Code</p>
                  <p className="text-white font-bold text-lg tracking-widest">{(classData as any).join_code || "------"}</p>
                </div>
                <Link href={`/assignments/create?class=${classData.id}`}>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2 rounded-xl backdrop-blur-sm">
                    <Plus className="w-4 h-4" />
                    Assignment
                  </Button>
                </Link>
                <Link href={`/materials/upload?class=${classData.id}`}>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30 gap-2 rounded-xl backdrop-blur-sm">
                    <Plus className="w-4 h-4" />
                    Material
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — GC style */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full border-b border-gray-200 dark:border-gray-700 bg-transparent rounded-none h-auto p-0 mb-6">
          {[
            { value: "stream", label: "Stream", icon: Bell },
            { value: "classwork", label: "Classwork", icon: ClipboardList },
            { value: "people", label: "People", icon: Users },
            ...(user.role === "teacher" ? [{ value: "grades", label: "Grades", icon: Star }] : []),
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </TabsList>

        {/* ── STREAM TAB ── */}
        <TabsContent value="stream" className="mt-0">
          <div className="max-w-3xl mx-auto space-y-4 pb-4">
            {/* Post box — teacher only */}
            {user.role === "teacher" && (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-3">
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder={`Announce something to ${classData.class_name}...`}
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        rows={3}
                        className="rounded-xl resize-none border-gray-200 dark:border-gray-700 focus:border-blue-400"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handlePost}
                          disabled={!postContent.trim() || posting}
                          size="sm"
                          className="gap-2 rounded-xl"
                        >
                          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming assignments widget */}
            {assignments.filter((a) => new Date(a.deadline) >= new Date()).length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Upcoming Deadlines
                  </p>
                  <div className="space-y-2">
                    {assignments
                      .filter((a) => new Date(a.deadline) >= new Date())
                      .slice(0, 3)
                      .map((a) => (
                        <Link key={a.id} href={`/assignments/${a.id}`}>
                          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-xl hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{a.title}</span>
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(a.deadline)}</span>
                          </div>
                        </Link>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stream posts */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No posts yet</p>
                {user.role === "teacher" && <p className="text-sm mt-1">Share something with your class above</p>}
              </div>
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id} className={`border-0 shadow-sm rounded-2xl ${ann.pinned ? "ring-2 ring-blue-200 dark:ring-blue-800" : ""}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                          {getInitials((ann.author as any)?.name || "T")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {(ann.author as any)?.name || "Teacher"}
                          </p>
                          {ann.pinned && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs gap-1">
                              <Pin className="w-2.5 h-2.5" />Pinned
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">{formatRelativeTime(ann.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{ann.content}</p>
                      </div>
                      {user.role === "teacher" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handlePinAnnouncement(ann.id, ann.pinned)} className="gap-2">
                              <Pin className="w-4 h-4" />
                              {ann.pinned ? "Unpin" : "Pin to top"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteAnnouncement(ann.id)} className="text-red-600 gap-2">
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── CLASSWORK TAB ── */}
        <TabsContent value="classwork" className="mt-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Teacher actions */}
            {user.role === "teacher" && (
              <div className="flex gap-3 flex-wrap">
                <Link href={`/assignments/create?class=${classData.id}`}>
                  <Button className="gap-2 rounded-xl" size="sm">
                    <Plus className="w-4 h-4" />
                    Create Assignment
                  </Button>
                </Link>
                <Link href={`/materials/upload?class=${classData.id}`}>
                  <Button variant="outline" className="gap-2 rounded-xl" size="sm">
                    <Plus className="w-4 h-4" />
                    Upload Material
                  </Button>
                </Link>
                <Link href={`/quiz?class=${classData.id}`}>
                  <Button variant="outline" className="gap-2 rounded-xl" size="sm">
                    <Plus className="w-4 h-4" />
                    Create Assessment
                  </Button>
                </Link>
              </div>
            )}

            {/* Assignments section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Assignments</h3>
                <Badge variant="secondary" className="text-xs">{assignments.length}</Badge>
              </div>

              {loading ? (
                <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assign) => {
                    const status = getDeadlineStatus(assign.deadline);
                    return (
                      <div key={assign.id} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          status === "overdue" ? "bg-red-100 dark:bg-red-900" :
                          status === "today" ? "bg-orange-100 dark:bg-orange-900" :
                          "bg-blue-100 dark:bg-blue-900"
                        }`}>
                          <ClipboardList className={`w-5 h-5 ${
                            status === "overdue" ? "text-red-600 dark:text-red-400" :
                            status === "today" ? "text-orange-600 dark:text-orange-400" :
                            "text-blue-600 dark:text-blue-400"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{assign.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Due: {formatDate(assign.deadline)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={status === "overdue" ? "destructive" : status === "today" ? "warning" : "success"} className="text-xs">
                            {status === "overdue" ? "Closed" : status === "today" ? "Due Today" : "Active"}
                          </Badge>
                          <Link href={`/assignments/${assign.id}`}>
                            <Button variant="ghost" size="sm" className="rounded-xl text-xs">View</Button>
                          </Link>
                          {user.role === "teacher" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteAssignment(assign.id)}>
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

            {/* Materials section */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Materials</h3>
                <Badge variant="secondary" className="text-xs">{materials.length}</Badge>
              </div>

              {loading ? (
                <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
              ) : materials.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No materials yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.map((mat) => {
                    // Check if material is locked for student
                    const isLocked = user.role === "student" &&
                      (mat as any).prerequisite_quiz_id &&
                      !unlockedMaterials.has(mat.id);

                    return (
                      <div key={mat.id} className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border shadow-sm transition-all group ${
                        isLocked
                          ? "border-gray-200 dark:border-gray-700 opacity-70"
                          : "border-gray-100 dark:border-gray-700 hover:shadow-md"
                      }`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isLocked ? "bg-gray-100 dark:bg-gray-700" : "bg-green-100 dark:bg-green-900"
                        }`}>
                          {isLocked
                            ? <Lock className="w-5 h-5 text-gray-400" />
                            : <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{mat.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {mat.topic && `${mat.topic} · `}
                            {mat.meeting && `Meeting ${mat.meeting} · `}
                            {formatDate(mat.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isLocked ? (
                            <LockedMaterialBadge
                              materialTitle={mat.title}
                              passingScore={(mat as any).passing_score || 75}
                            />
                          ) : mat.file_url ? (
                            <a href={mat.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </Button>
                            </a>
                          ) : null}
                          {user.role === "teacher" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteMaterial(mat.id)}>
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
          </div>
        </TabsContent>

        {/* ── PEOPLE TAB ── */}
        <TabsContent value="people" className="mt-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Class Code — teacher only */}
            {user.role === "teacher" && (classData as any).join_code && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Class Join Code</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold tracking-widest text-blue-900 dark:text-blue-100">
                    {(classData as any).join_code}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText((classData as any).join_code);
                      toast.success("Code copied!");
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Share this code with students to join the class
                </p>
              </div>
            )}

            {/* Teacher */}
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                Teacher
              </h3>
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">AS</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Agus Supriyono, S.Pd.,MM</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">English Teacher · SMK Negeri 1 Buduran</p>
                </div>
              </div>
            </div>

            {/* Students */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  Students
                  <Badge variant="secondary" className="text-xs">{students.length}</Badge>
                </h3>
              </div>

              {loading ? (
                <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No students enrolled yet</p>
                  {user.role === "teacher" && (classData as any).join_code && (
                    <p className="text-xs mt-1">Share code <strong>{(classData as any).join_code}</strong> with students</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((student, idx) => (
                    <div key={student.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-gradient-to-br from-green-400 to-teal-500 text-white text-xs font-bold">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── GRADES TAB (Teacher only) ── */}
        {user.role === "teacher" && (
          <TabsContent value="grades" className="mt-0">
            <div className="max-w-3xl mx-auto">
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Grade Overview</p>
                <p className="text-sm mt-1">View detailed grades in the Grades section</p>
                <Link href="/grades" className="mt-4 inline-block">
                  <Button className="gap-2 rounded-xl mt-4">
                    <Star className="w-4 h-4" />
                    Go to Grades
                  </Button>
                </Link>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
