"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BookOpen, ClipboardList, FileText,
  Plus, ArrowRight, TrendingUp, Clock, CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { User, Assignment, Submission } from "@/types";

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
        <div className="flex gap-2">
          <Link href="/assignments/create">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Assignment
            </Button>
          </Link>
          <Link href="/materials/upload">
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Upload Material
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? "..." : card.value}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {(sub.student as any)?.name || "Student"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {(sub.assignment as any)?.title || "Assignment"}
                      </p>
                    </div>
                    <Badge variant="warning" className="text-xs whitespace-nowrap ml-2">Ungraded</Badge>
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {assignment.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(assignment.class as any)?.class_name} · {formatDate(assignment.deadline)}
                        </p>
                      </div>
                      <Clock className="w-4 h-4 text-orange-500 ml-2 flex-shrink-0" />
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
              { href: "/classes", label: "Manage Classes", icon: Users, color: "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" },
              { href: "/materials/upload", label: "Upload Material", icon: BookOpen, color: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400" },
              { href: "/assignments/create", label: "New Assignment", icon: ClipboardList, color: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400" },
              { href: "/attendance", label: "View Attendance", icon: CheckCircle, color: "bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <div className={`${action.color} rounded-xl p-4 text-center hover:opacity-80 transition-opacity cursor-pointer`}>
                    <Icon className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-xs font-medium">{action.label}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
