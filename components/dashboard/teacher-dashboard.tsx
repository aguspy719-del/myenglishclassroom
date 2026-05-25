"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BookOpen, ClipboardList, FileText,
  Plus, ArrowRight, TrendingUp, Clock, CheckCircle, Megaphone, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { User, Assignment, Submission, Announcement } from "@/types";

interface TeacherDashboardProps {
  user: User;
}

interface Stats {
  totalStudents: number;
  totalClasses: number;
  totalAssignments: number;
  pendingSubmissions: number;
}

export function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalClasses: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const [classesRes, studentsRes, assignmentsRes, submissionsRes] = await Promise.all([
        supabase.from("classes").select("id", { count: "exact" }),
        supabase.from("users").select("id", { count: "exact" }).eq("role", "student"),
        supabase.from("assignments").select("id", { count: "exact" }),
        supabase
          .from("submissions")
          .select("*, student:users(name, email), assignment:assignments(title)")
          .is("score", null)
          .order("submitted_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalClasses: classesRes.count || 0,
        totalStudents: studentsRes.count || 0,
        totalAssignments: assignmentsRes.count || 0,
        pendingSubmissions: submissionsRes.data?.length || 0,
      });

      setRecentSubmissions(submissionsRes.data || []);

      const { data: upcoming } = await supabase
        .from("assignments")
        .select("*, class:classes(class_name)")
        .gte("deadline", new Date().toISOString())
        .order("deadline", { ascending: true })
        .limit(4);

      setUpcomingAssignments(upcoming || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const fetchAnnouncements = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setAnnouncementsLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("announcements").insert([{
      title: newTitle.trim(),
      content: newContent.trim(),
    }]);
    if (error) {
      toast.error("Failed to create announcement");
    } else {
      toast.success("Announcement created");
      setNewTitle("");
      setNewContent("");
      setShowCreateForm(false);
      fetchAnnouncements();
    }
    setSubmitting(false);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete announcement");
    } else {
      toast.success("Announcement deleted");
      fetchAnnouncements();
    }
  };

  const statCards = [
    { title: "Total Students", value: stats.totalStudents, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950", href: "/classes" },
    { title: "Total Classes", value: stats.totalClasses, icon: BookOpen, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", href: "/classes" },
    { title: "Total Assignments", value: stats.totalAssignments, icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950", href: "/assignments" },
    { title: "Needs Grading", value: stats.pendingSubmissions, icon: FileText, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950", href: "/assignments" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.name.split(" ")[0]}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/assignments/create" className="flex-1 sm:flex-none">
            <Button size="sm" className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">New Assignment</span>
            </Button>
          </Link>
          <Link href="/materials/upload" className="flex-1 sm:flex-none">
            <Button size="sm" variant="outline" className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Upload Material</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {loading ? "..." : card.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">{card.title}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Submissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Submissions</CardTitle>
            <Link href="/assignments">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No submissions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0 overflow-hidden mr-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {(sub.student as any)?.name || "Student"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {(sub.assignment as any)?.title || "Assignment"}
                      </p>
                    </div>
                    <Badge variant="warning" className="text-xs whitespace-nowrap flex-shrink-0">Ungraded</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Upcoming Deadlines</CardTitle>
            <Link href="/assignments">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : upcomingAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming deadlines</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((assignment) => (
                  <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex-1 min-w-0 overflow-hidden mr-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {assignment.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {(assignment.class as any)?.class_name} · {formatDate(assignment.deadline)}
                        </p>
                      </div>
                      <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/classes", label: "My Classes", icon: Users, color: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" },
              { href: "/assignments/create", label: "New Assignment", icon: ClipboardList, color: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400" },
              { href: "/attendance", label: "Attendance", icon: CheckCircle, color: "bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400" },
              { href: "/teaching-aids", label: "Teaching Aids", icon: BookOpen, color: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <div className={`${action.color} rounded-xl p-3 sm:p-4 text-center hover:opacity-80 transition-opacity cursor-pointer`}>
                    <Icon className="w-6 h-6 mx-auto mb-2 flex-shrink-0" />
                    <p className="text-xs font-medium truncate">{action.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Announcements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600" />
            Announcements
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Cancel</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> New</>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Inline create form */}
          {showCreateForm && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl space-y-2 border border-blue-100 dark:border-blue-900">
              <Input
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-lg text-sm"
              />
              <Textarea
                placeholder="Content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="rounded-lg text-sm min-h-[80px] resize-none"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleCreateAnnouncement}
                disabled={submitting}
              >
                {submitting ? "Posting..." : "Post Announcement"}
              </Button>
            </div>
          )}

          {/* List */}
          {announcementsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No announcements yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group"
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ann.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{ann.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(ann.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
