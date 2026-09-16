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
import { Flame } from "lucide-react";
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
  const [loginStreak, setLoginStreak] = useState<number>(user.login_streak || 0);

  useEffect(() => {
    const supabase = createClient();

    // Daily login streak — "rajin masuk" XP (server-side idempotent, 1x per day)
    fetch("/api/auth/login-streak", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && !d.alreadyClaimed) {
          setUserData((u: any) => ({ ...u, points: d.points, level: d.level }));
        }
        if (d?.ok) setLoginStreak(d.streak || 0);
      })
      .catch(() => {});

    const fetchData = async () => {
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

    // Realtime: auto-update when announcements, assignments, or grades change
    const channel = supabase
      .channel("student-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" },
        () => {
          supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3)
            .then(({ data }) => { if (data) setAnnouncements(data); });
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "assignments",
          filter: `class_id=eq.${user.class_id}` },
        () => {
          supabase.from("assignments").select("*, class:classes(class_name)")
            .eq("class_id", user.class_id || "")
            .gte("deadline", new Date().toISOString())
            .order("deadline", { ascending: true }).limit(4)
            .then(({ data }) => { if (data) setUpcomingAssignments(data); });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "submissions",
          filter: `student_id=eq.${user.id}` },
        () => {
          supabase.from("submissions").select("*, assignment:assignments(title)")
            .eq("student_id", user.id).not("score", "is", null)
            .order("submitted_at", { ascending: false }).limit(4)
            .then(({ data }) => { if (data) setRecentGrades(data as any[]); });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id, user.class_id]);

  const points = userData?.points || 0;
  const level = userData?.level || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hello, {user.name.split(" ")[0]}! 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Streak Card — replaced XP/Level/Badges, focused on diligence */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-lg">🔥 {loginStreak} day{loginStreak === 1 ? "" : "s"} streak!</p>
                <p className="text-orange-100 text-sm">+10 XP per day, up to 50 XP</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-yellow-300">{loginStreak >= 7 ? "7+" : 7 - loginStreak}</p>
              <p className="text-xs text-orange-100">days to badge</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div
                key={day}
                className={`h-2 flex-1 rounded-full ${day <= Math.min(loginStreak, 7) ? "bg-white" : "bg-white/25"}`}
              />
            ))}
          </div>
          <p className="text-xs text-orange-100 mt-2">
            Log in every day — keep the streak alive!
          </p>
        </CardContent>
      </Card>

      {/* Stats — streak first, then the essentials */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Login Streak", value: `${loginStreak}d`, icon: Flame, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950", href: "/profile" },
          { label: "Active Tasks", value: loading ? "..." : upcomingAssignments.length, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", href: "/classes" },
          { label: "Latest Grade", value: loading ? "..." : recentGrades.length > 0 ? `${recentGrades[0].score}` : "-", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950", href: "/grades" },
          { label: "Attendance", value: loading ? "..." : `${attendanceRate}%`, icon: UserCheck, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950", href: "/attendance" },
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
                        {isUrgent ? <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> : <Clock className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
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
          ) : (              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-100 dark:border-emerald-900">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{ann.title}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{ann.content}</p>
                    <p className="text-xs text-emerald-500 mt-1">{formatDate(ann.created_at)}</p>
                  </div>
                ))}
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
