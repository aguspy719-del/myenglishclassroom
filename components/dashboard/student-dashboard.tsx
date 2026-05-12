"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, ClipboardList, Star, UserCheck,
  Clock, CheckCircle, AlertCircle, ArrowRight, Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getGradeColor, getGradeLabel } from "@/lib/utils";
import type { User, Assignment, Submission, Announcement } from "@/types";

interface StudentDashboardProps {
  user: User;
}

export function StudentDashboard({ user }: StudentDashboardProps) {
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [recentGrades, setRecentGrades] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const [assignmentsRes, gradesRes, announcementsRes, attendanceRes] = await Promise.all([
        supabase
          .from("assignments")
          .select("*, class:classes(class_name)")
          .eq("class_id", user.class_id || "")
          .gte("deadline", new Date().toISOString())
          .order("deadline", { ascending: true })
          .limit(4),
        supabase
          .from("submissions")
          .select("*, assignment:assignments(title)")
          .eq("student_id", user.id)
          .not("score", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(4),
        supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("attendance")
          .select("status")
          .eq("student_id", user.id),
      ]);

      setUpcomingAssignments(assignmentsRes.data || []);
      setRecentGrades(gradesRes.data || []);
      setAnnouncements(announcementsRes.data || []);

      const attendance = attendanceRes.data || [];
      if (attendance.length > 0) {
        const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
        setAttendanceRate(Math.round((present / attendance.length) * 100));
      }

      setLoading(false);
    };

    fetchData();
  }, [user.id, user.class_id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Hello, {user.name.split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Assignments", value: loading ? "..." : upcomingAssignments.length, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950", href: "/assignments" },
          { label: "Latest Grade", value: loading ? "..." : recentGrades.length > 0 ? `${recentGrades[0].score}` : "-", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", href: "/grades" },
          { label: "Attendance", value: loading ? "..." : `${attendanceRate}%`, icon: UserCheck, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", href: "/attendance" },
          { label: "Materials", value: "View", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950", href: "/materials" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Assignments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Upcoming Assignments</CardTitle>
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
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : upcomingAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming assignments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((assignment) => {
                  const deadline = new Date(assignment.deadline);
                  const now = new Date();
                  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 2;

                  return (
                    <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {isUrgent ? (
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {assignment.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Due: {formatDate(assignment.deadline)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={isUrgent ? "destructive" : "info"}
                          className="text-xs ml-2 whitespace-nowrap"
                        >
                          {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Grades */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Grades</CardTitle>
            <Link href="/grades">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentGrades.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No grades yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentGrades.map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {(submission.assignment as any)?.title || "Assignment"}
                      </p>
                      {submission.feedback && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {submission.feedback}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`text-lg font-bold ${getGradeColor(submission.score || 0)}`}>
                        {submission.score}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getGradeLabel(submission.score || 0)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-100 dark:border-blue-900">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{ann.title}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{ann.content}</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{formatDate(ann.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
