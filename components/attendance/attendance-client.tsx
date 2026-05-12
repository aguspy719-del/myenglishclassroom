"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UserCheck, CheckCircle, XCircle, Clock, AlertCircle, Filter, Calendar } from "lucide-react";
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

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType }> = {
  present: { label: "Hadir", color: "success", icon: CheckCircle },
  absent: { label: "Tidak Hadir", color: "destructive", icon: XCircle },
  late: { label: "Terlambat", color: "warning", icon: Clock },
  excused: { label: "Izin", color: "info", icon: AlertCircle },
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

    const [classesRes] = await Promise.all([
      supabase.from("classes").select("*").order("class_name"),
    ]);
    setClasses(classesRes.data || []);

    if (user.role === "student") {
      // Fetch student's own attendance
      const { data } = await supabase
        .from("attendance")
        .select("*, class:classes(class_name)")
        .eq("student_id", user.id)
        .order("date", { ascending: false });
      setAttendance(data || []);

      // Check today's attendance
      const today = new Date().toISOString().split("T")[0];
      const todayRecord = data?.find((a) => a.date === today && a.class_id === user.class_id);
      setTodayAttendance(todayRecord || null);
    } else {
      // Teacher: fetch all attendance for selected class/date
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
      toast.error("Kamu belum terdaftar di kelas manapun");
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
      } else {
        const { error } = await supabase.from("attendance").insert([{
          student_id: user.id,
          class_id: user.class_id,
          date: today,
          status,
          timestamp: new Date().toISOString(),
        }]);
        if (error) throw error;
      }

      toast.success(`Absensi berhasil: ${statusConfig[status].label}`);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal absen: " + err.message);
    } finally {
      setMarking(false);
    }
  };

  // Calculate stats for student
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
          {user.role === "teacher" ? "Rekap Absensi" : "Absensi Saya"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {user.role === "teacher" ? "Pantau kehadiran siswa" : "Catat dan lihat riwayat kehadiran"}
        </p>
      </div>

      {/* Student: Mark Attendance */}
      {user.role === "student" && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Absen Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAttendance ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Sudah absen hari ini
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Status: <strong>{statusConfig[todayAttendance.status as AttendanceStatus]?.label}</strong>
                    {" • "}{formatDateTime(todayAttendance.timestamp)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Pilih status kehadiran kamu hari ini:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([status, config]) => {
                    const Icon = config.icon;
                    return (
                      <Button
                        key={status}
                        variant="outline"
                        className={`h-16 flex-col gap-1 ${
                          status === "present" ? "hover:bg-green-50 hover:border-green-400 dark:hover:bg-green-950" :
                          status === "absent" ? "hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950" :
                          status === "late" ? "hover:bg-yellow-50 hover:border-yellow-400 dark:hover:bg-yellow-950" :
                          "hover:bg-blue-50 hover:border-blue-400 dark:hover:bg-blue-950"
                        }`}
                        onClick={() => handleMarkAttendance(status)}
                        disabled={marking}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{config.label}</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-500">Hadir</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{lateCount}</p>
              <p className="text-xs text-gray-500">Terlambat</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs text-gray-500">Tidak Hadir</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{attendanceRate}%</p>
              <p className="text-xs text-gray-500">Kehadiran</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Teacher: Filters */}
      {user.role === "teacher" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Attendance Records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {user.role === "teacher" ? `Rekap Absensi (${attendance.length} data)` : "Riwayat Absensi"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Belum ada data absensi</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.map((record) => {
                const config = statusConfig[record.status as AttendanceStatus];
                const Icon = config?.icon || CheckCircle;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        record.status === "present" ? "bg-green-100 dark:bg-green-900" :
                        record.status === "absent" ? "bg-red-100 dark:bg-red-900" :
                        record.status === "late" ? "bg-yellow-100 dark:bg-yellow-900" :
                        "bg-blue-100 dark:bg-blue-900"
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          record.status === "present" ? "text-green-600 dark:text-green-400" :
                          record.status === "absent" ? "text-red-600 dark:text-red-400" :
                          record.status === "late" ? "text-yellow-600 dark:text-yellow-400" :
                          "text-blue-600 dark:text-blue-400"
                        }`} />
                      </div>
                      <div>
                        {user.role === "teacher" && (
                          <p className="font-medium text-sm text-gray-900 dark:text-white">
                            {(record.student as any)?.name || "Siswa"}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(record.date)}
                          {(record.class as any)?.class_name && ` • ${(record.class as any).class_name}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={config?.color as any || "secondary"}>
                      {config?.label || record.status}
                    </Badge>
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
