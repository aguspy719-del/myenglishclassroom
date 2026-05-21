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
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getGradeColor, getGradeLabel } from "@/lib/utils";
import { BADGES, POINTS_PER_LEVEL } from "@/lib/gamification";
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
  const [userData, setUserData] = useState<any>(user);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [assignmentsRes, gradesRes, announcementsRes, attendanceRes, userRes] = await Promise.all([
        supabase.from("assignments").select("*, class:classes(class_name)").eq("class_id", user.class_id || "").gte("deadline", new Date().toISOString()).order("deadline", { ascending: true }).limit(4),
        supabase.from("submissions").select("*, assignment:assignments(title)").eq("student_id", user.id).not("score", "is", null).order("submitted_at", { ascending: false }).limit(4),
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
        supabase.from("attendance").select("status").eq("student_id", user.id),
        supabase.from("users").select("points, level, badges").eq("id", user.id).single(),
      ]);
      setUpcomingAssignments(assignmentsRes.data || []);
      setRecentGrades(gradesRes.data || []);
      setAnnouncements(announcementsRes.data || []);
      if (userRes.data) setUserData({ ...user, ...userRes.data });
      const attendance = attendanceRes.data || [];
      if (attendance.length > 0) {
        const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
        setAttendanceRate(Math.round((present / attendance.length) * 100));
      }
      setLoading(false);
    };
    fetchData();
  }, [user.id, user.class_id]);

  const points = userData?.points || 0;
  const level = userData?.level || 1;
  const badges: string[] = userData?.badges || [];
  const pointsInLevel = points % POINTS_PER_LEVEL;
  const progressPercent = Math.round((pointsInLevel / POINTS_PER_LEVEL) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hello, {user.name.split(" ")[0]}! 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* XP Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold">{level}</span>
              </div>
              <div>
                <p className="font-bold text-lg">Level {level}</p>
                <p className="text-blue-200 text-sm">{points} XP total</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-yellow-300">{POINTS_PER_LEVEL - pointsInLevel} XP</p>
              <p className="text-xs text-blue-200">to Level {level + 1}</p>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2.5 bg-white/20 [&>div]:bg-yellow-400" />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-blue-200">{pointsInLevel} / {POINTS_PER_LEVEL} XP</p>
            <div className="flex gap-1">
              {BADGES.slice(0, 4).map((badge) => (
                <span key={badge.id} className={`text-lg ${badges.includes(badge.id) ? "" : "opacity-30 grayscale"}`} title={badge.name}>{badge.icon}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active Tasks", value: loading ? "..." : upcomingAssignments.length, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950", href: "/classes" },
          { label: "Latest Grade", value: loading ? "..." : recentGrades.length > 0 ? `${recentGrades[0].score}` : "-", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", href: "/grades" },
          { label: "Attendance", value: loading ? "..." : `${attendanceRate}%`, icon: UserCheck, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", href: "/attendance" },
          { label: "My Classes", value: "View", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950", href: "/classes" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Upcoming Assignments</CardTitle>
            <Link href="/classes"><Button variant="ghost" size="sm" className="gap-1 text-xs">View All <ArrowRight className="w-3 h-3" /></Button></Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : upcomingAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No upcoming assignments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((a) => {
                  const daysLeft = Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000);
                  const isUrgent = daysLeft <= 2;
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {isUrgent ? <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> : <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                          <p className="text-xs text-gray-500">Due: {formatDate(a.deadline)}</p>
                        </div>
                      </div>
                      <Badge variant={isUrgent ? "destructive" : "info"} className="text-xs ml-2 whitespace-nowrap">
                        {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Grades</CardTitle>
            <Link href="/grades"><Button variant="ghost" size="sm" className="gap-1 text-xs">View All <ArrowRight className="w-3 h-3" /></Button></Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : recentGrades.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No grades yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentGrades.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{(s.assignment as any)?.title || "Assignment"}</p>
                      {s.feedback && <p className="text-xs text-gray-500 truncate">{s.feedback}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className={`text-lg font-bold ${getGradeColor(s.score || 0)}`}>{s.score}</span>
                      <Badge variant="outline" className="text-xs">{getGradeLabel(s.score || 0)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2"><Bell className="w-4 h-4" />Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{ann.title}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{ann.content}</p>
                  <p className="text-xs text-blue-500 mt-1">{formatDate(ann.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
