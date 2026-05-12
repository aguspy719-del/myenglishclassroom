"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UserCheck, CheckCircle, XCircle, Clock, AlertCircle,
  Calendar, Trash2, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { User, Attendance, Class, AttendanceStatus } from "@/types";

interface AttendanceClientProps {
  user: User;
}

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType; bg: string; text: string }> = {
  present: { label: "Present", color: "success", icon: CheckCircle, bg: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" },
  absent: { label: "Absent", color: "destructive", icon: XCircle, bg: "bg-red-100 dark:bg-red-900", text: "text-red-600 dark:text-red-400" },
  late: { label: "Late", color: "warning", icon: Clock, bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-600 dark:text-yellow-400" },
  excused: { label: "Excused", color: "info", icon: AlertCircle, bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
};

export function AttendanceClient({ user }: AttendanceClientProps) {
  const searchParams = useSearchParams();
  const classFilter = searchParams.get("class") || "all";

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [selectedClass, setSelectedClass] = useState(classFilter);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: classesData } = await supabase.from("classes").select("*").order("class_name");
    setClasses(classesData || []);

    if (user.role === "student") {
      const { data } = await supabase
        .from("attendance")
        .select("*, class:classes(class_name)")
        .eq("student_id", user.id)
        .order("date", { ascending: false });
      setAttendance(data || []);

      const today = new Date().toISOString().split("T")[0];
      const todayRecord = data?.find((a) => a.date === today && a.class_id === user.class_id);
      setTodayAttendance(todayRecord || null);
    } else {
      let query = supabase
        .from("attendance")
        .select("*, student:users(name, email), class:classes(class_name)")
        .order("timestamp", { ascending: false });

      if (selectedClass !== "all") query = query.eq("class_id", selectedClass);
      if (selectedDate) query = query.eq("date", selectedDate);

      const { data } = await query;
      setAttendance(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass, selectedDate]);

  const handleMarkAttendance = async (status: AttendanceStatus) => {
    if (!user.class_id) {
      toast.error("You are not registered in any class");
      return;
    }
    setMarking(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    try {
      if (todayAttendance) {
        const { error } = await supabase
          .from("attendance")
          .update({ status, timestamp: new Date().toISOString() })
          .eq("id", todayAttendance.id);
        if (error) throw error;
        toast.success(`Attendance updated: ${statusConfig[status].label}`);
      } else {
        const { error } = await supabase.from("attendance").insert([{
          student_id: user.id,
          class_id: user.class_id,
          date: today,
          status,
          timestamp: new Date().toISOString(),
        }]);
        if (error) throw error;
        toast.success(`Attendance marked: ${statusConfig[status].label}`);
      }
      fetchData();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setMarking(false);
    }
  };

  // Student: reset today's attendance
  const handleResetToday = async () => {
    if (!todayAttendance) return;
    if (!confirm("Reset today's attendance? You can re-mark it again.")) return;

    const supabase = createClient();
    const { error } = await supabase.from("attendance").delete().eq("id", todayAttendance.id);
    if (error) {
      toast.error("Failed to reset attendance");
    } else {
      toast.success("Attendance reset. You can mark again.");
      fetchData();
    }
  };

  // Teacher: delete a record
  const handleDeleteRecord = async (id: string, studentName: string) => {
    if (!confirm(`Delete attendance record for ${studentName}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      fetchData();
    }
  };

  // Teacher: change status of a record
  const handleChangeStatus = async (id: string, newStatus: AttendanceStatus) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("attendance")
      .update({ status: newStatus, timestamp: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      fetchData();
    }
  };

  const presentCount = attendance.filter((a) => a.status === "present").length;
  const lateCount = attendance.filter((a) => a.status === "late").length;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const total = attendance.length;
  const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user.role === "teacher" ? "Attendance Records" : "My Attendance"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {user.role === "teacher" ? "Monitor and manage student attendance" : "Track your daily attendance"}
        </p>
      </div>

      {/* Student: Mark Attendance */}
      {user.role === "student" && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                Today&apos;s Attendance
              </CardTitle>
              {todayAttendance && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToday}
                  className="text-gray-500 hover:text-red-600 gap-1 text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {todayAttendance ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-3 p-4 rounded-xl ${statusConfig[todayAttendance.status as AttendanceStatus]?.bg}`}>
                  {(() => {
                    const config = statusConfig[todayAttendance.status as AttendanceStatus];
                    const Icon = config?.icon || CheckCircle;
                    return <Icon className={`w-6 h-6 ${config?.text} flex-shrink-0`} />;
                  })()}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Marked as: <span className="font-bold">{statusConfig[todayAttendance.status as AttendanceStatus]?.label}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(todayAttendance.timestamp)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Wrong status? Click <strong>Reset</strong> above to re-mark.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 font-medium">
                  Select your attendance status for today:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([status, config]) => {
                    const Icon = config.icon;
                    return (
                      <Button
                        key={status}
                        variant="outline"
                        className={`h-16 flex-col gap-1.5 rounded-xl border-2 transition-all ${
                          status === "present" ? "hover:bg-green-50 hover:border-green-400 dark:hover:bg-green-950" :
                          status === "absent" ? "hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950" :
                          status === "late" ? "hover:bg-yellow-50 hover:border-yellow-400 dark:hover:bg-yellow-950" :
                          "hover:bg-blue-50 hover:border-blue-400 dark:hover:bg-blue-950"
                        }`}
                        onClick={() => handleMarkAttendance(status)}
                        disabled={marking}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{config.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student: Stats */}
      {user.role === "student" && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Present", value: presentCount, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
            { label: "Late", value: lateCount, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" },
            { label: "Absent", value: absentCount, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
            { label: "Rate", value: `${attendanceRate}%`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className={`pt-4 pb-4 text-center rounded-xl ${stat.bg}`}>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teacher: Filters */}
      {user.role === "teacher" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Attendance Records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {user.role === "teacher"
              ? `Records (${attendance.length})`
              : "Attendance History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No attendance records found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.map((record) => {
                const config = statusConfig[record.status as AttendanceStatus];
                const Icon = config?.icon || CheckCircle;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config?.bg}`}>
                        <Icon className={`w-4 h-4 ${config?.text}`} />
                      </div>
                      <div className="min-w-0">
                        {user.role === "teacher" && (
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {(record.student as any)?.name || "Student"}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(record.date)}
                          {(record.class as any)?.class_name && ` · ${(record.class as any).class_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Teacher: change status dropdown */}
                      {user.role === "teacher" ? (
                        <>
                          <Select
                            value={record.status}
                            onValueChange={(v) => handleChangeStatus(record.id, v as AttendanceStatus)}
                          >
                            <SelectTrigger className="h-8 w-28 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([s, c]) => (
                                <SelectItem key={s} value={s} className="text-xs">{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteRecord(record.id, (record.student as any)?.name || "Student")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant={config?.color as any || "secondary"} className="text-xs">
                          {config?.label || record.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
