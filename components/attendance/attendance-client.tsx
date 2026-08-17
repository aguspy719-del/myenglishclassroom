"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UserCheck, CheckCircle, XCircle, Clock, AlertCircle,
  Calendar, Trash2, RefreshCw, ChevronDown, ChevronUp, BarChart2,
  FileSpreadsheet, Search, Loader2, TableProperties, MapPin, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatDateTime, getInitials } from "@/lib/utils";
import type { User, Attendance, Class, AttendanceStatus } from "@/types";

interface ClassSummary {
  classId: string;
  className: string;
  presentCount: number;
  totalStudents: number;
  rate: number;
}

interface AttendanceClientProps {
  user: User;
}

interface StudentRecapRow {
  studentId: string;
  studentName: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number;
}

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType; bg: string; text: string }> = {
  present: { label: "Present", color: "success", icon: CheckCircle, bg: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" },
  absent: { label: "Absent", color: "destructive", icon: XCircle, bg: "bg-red-100 dark:bg-red-900", text: "text-red-600 dark:text-red-400" },
  late: { label: "Late", color: "warning", icon: Clock, bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-600 dark:text-yellow-400" },
  excused: { label: "Excused", color: "info", icon: AlertCircle, bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
};

// ── Konfigurasi lokasi sekolah ─────────────────────────────
// Hanya dipakai untuk menampilkan info di UI siswa
const SCHOOL_LOCATION_NAME = "SMK Negeri 1 Buduran";
const MAX_DISTANCE_METERS = 150;

// Minta lokasi GPS dari browser
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser ini"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

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
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);

  // Teacher rekap states
  const [activeTab, setActiveTab] = useState("records");
  const [rekapClass, setRekapClass] = useState("all");
  const [rekapRows, setRekapRows] = useState<StudentRecapRow[]>([]);
  const [rekapLoading, setRekapLoading] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Teacher: tambah record manual
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualForm, setManualForm] = useState({
    class_id: "",
    student_id: "",
    date: new Date().toISOString().split("T")[0],
    status: "excused" as AttendanceStatus,
  });
  const [manualStudents, setManualStudents] = useState<{ id: string; name: string }[]>([]);
  const [savingManual, setSavingManual] = useState(false);

  // Student: geolocation state
  const [locationStatus, setLocationStatus] = useState<"idle" | "checking" | "ok" | "denied" | "tooFar">("idle");
  const [studentDistance, setStudentDistance] = useState<number | null>(null);

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

      if (classesData && classesData.length > 0) {
        const classesToSummarise = selectedClass !== "all"
          ? classesData.filter((c) => c.id === selectedClass)
          : classesData;

        const summaries: ClassSummary[] = await Promise.all(
          classesToSummarise.map(async (cls) => {
            const { count: totalStudents } = await supabase
              .from("users")
              .select("id", { count: "exact", head: true })
              .eq("class_id", cls.id)
              .eq("role", "student");

            const presentCount = (data || []).filter(
              (a) => a.class_id === cls.id && (a.status === "present" || a.status === "late")
            ).length;

            const total = totalStudents || 0;
            const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

            return { classId: cls.id, className: cls.class_name, presentCount, totalStudents: total, rate };
          })
        );
        setClassSummaries(summaries.filter((s) => s.totalStudents > 0));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedClass, selectedDate]);

  // ── Rekap fetch ────────────────────────────────────────────
  const fetchRekap = async (classId: string) => {
    setRekapLoading(true);
    const supabase = createClient();

    const targetClasses = classId === "all" ? classes : classes.filter((c) => c.id === classId);
    const allRows: StudentRecapRow[] = [];

    for (const cls of targetClasses) {
      const { data: students } = await supabase
        .from("users").select("id, name").eq("class_id", cls.id).eq("role", "student").order("name");
      if (!students || students.length === 0) continue;

      const { data: records } = await supabase
        .from("attendance").select("student_id, status, date").eq("class_id", cls.id);

      // Total pertemuan = jumlah tanggal UNIK yang ada absensi di kelas ini
      // Kalau hari libur tidak ada yang absen = tidak terhitung otomatis
      const uniqueDates = new Set((records || []).map((r) => r.date));
      const totalPertemuan = uniqueDates.size;

      students.forEach((student) => {
        const sr = (records || []).filter((r) => r.student_id === student.id);
        const present = sr.filter((r) => r.status === "present").length;
        const late = sr.filter((r) => r.status === "late").length;
        const absent = sr.filter((r) => r.status === "absent").length;
        const excused = sr.filter((r) => r.status === "excused").length;
        const total = totalPertemuan; // pakai total pertemuan kelas, bukan total record siswa
        // Hadir = present + late + excused (izin tetap hadir secara administrasi)
        const rate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;
        allRows.push({ studentId: student.id, studentName: student.name, present, late, absent, excused, total, rate });
      });
    }

    setRekapRows(allRows);
    setRekapLoading(false);
  };

  useEffect(() => {
    if (user.role === "teacher" && activeTab === "rekap" && classes.length > 0) {
      fetchRekap(rekapClass);
    }
  }, [activeTab, rekapClass, classes]);

  // ── Load siswa saat kelas dipilih di dialog manual ─────────
  const loadManualStudents = async (classId: string) => {
    if (!classId) { setManualStudents([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("users").select("id, name").eq("class_id", classId).eq("role", "student").order("name");
    setManualStudents(data || []);
    setManualForm((prev) => ({ ...prev, student_id: "" }));
  };

  // ── Simpan record manual oleh guru ────────────────────────
  const handleSaveManual = async () => {
    if (!manualForm.class_id || !manualForm.student_id || !manualForm.date) {
      toast.error("Isi semua field");
      return;
    }
    setSavingManual(true);
    const supabase = createClient();

    // Cek apakah sudah ada record untuk siswa + tanggal + kelas ini
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", manualForm.student_id)
      .eq("class_id", manualForm.class_id)
      .eq("date", manualForm.date)
      .maybeSingle();

    if (existing) {
      // Update yang sudah ada
      const { error } = await supabase
        .from("attendance")
        .update({ status: manualForm.status, timestamp: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error("Gagal update: " + error.message); }
      else { toast.success("Record diupdate"); }
    } else {
      // Insert baru
      const { error } = await supabase.from("attendance").insert([{
        student_id: manualForm.student_id,
        class_id: manualForm.class_id,
        date: manualForm.date,
        status: manualForm.status,
        timestamp: new Date().toISOString(),
      }]);
      if (error) { toast.error("Gagal menyimpan: " + error.message); }
      else { toast.success("Record berhasil ditambahkan"); }
    }

    setSavingManual(false);
    setShowManualDialog(false);
    setManualForm({ class_id: "", student_id: "", date: new Date().toISOString().split("T")[0], status: "excused" });
    setManualStudents([]);
    fetchData();
  };

  // ── Export rekap Excel ─────────────────────────────────────
  const handleExportRekap = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const supabase = createClient();
      const targetClasses = rekapClass === "all" ? classes : classes.filter((c) => c.id === rekapClass);

      for (const cls of targetClasses) {
        const { data: students } = await supabase
          .from("users").select("id, name, email").eq("class_id", cls.id).eq("role", "student").order("name");
        if (!students || students.length === 0) continue;

        const { data: records } = await supabase
          .from("attendance").select("student_id, status, date").eq("class_id", cls.id).order("date");

        const sheetData = students.map((student, idx) => {
          const sr = (records || []).filter((r) => r.student_id === student.id);
          const present = sr.filter((r) => r.status === "present").length;
          const late = sr.filter((r) => r.status === "late").length;
          const absent = sr.filter((r) => r.status === "absent").length;
          const excused = sr.filter((r) => r.status === "excused").length;
          // Total pertemuan = tanggal unik di kelas, bukan record per siswa
          const uniqueDates = new Set((records || []).map((r) => r.date));
          const total = uniqueDates.size;
          const rate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;
          return {
            "No": idx + 1,
            "Nama Siswa": student.name,
            "Email": student.email,
            "Hadir": present,
            "Terlambat": late,
            "Absen": absent,
            "Izin": excused,
            "Total Pertemuan": total,
            "Kehadiran (%)": rate,
            "Keterangan": rate >= 80 ? "Baik" : rate >= 60 ? "Cukup" : "Kurang",
          };
        });

        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, cls.class_name.substring(0, 31));
      }

      const fileName = rekapClass === "all"
        ? `Rekap_Absensi_Semua_Kelas_${new Date().toISOString().split("T")[0]}.xlsx`
        : `Rekap_Absensi_${classes.find((c) => c.id === rekapClass)?.class_name}_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("Rekap absensi exported!");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Attendance actions ─────────────────────────────────────
  const handleMarkAttendance = async (status: AttendanceStatus) => {
    if (!user.class_id) { toast.error("You are not registered in any class"); return; }

    setMarking(true);
    setLocationStatus("checking");

    // 1. Ambil GPS dari browser
    let position: GeolocationPosition;
    try {
      position = await getCurrentPosition();
    } catch {
      setLocationStatus("denied");
      toast.error("Izin lokasi ditolak. Aktifkan GPS di browser untuk bisa absen.", { duration: 5000 });
      setMarking(false);
      return;
    }

    const { latitude, longitude } = position.coords;

    // 2. Kirim ke API route — validasi jarak di SERVER
    try {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, status }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.tooFar) {
          setLocationStatus("tooFar");
          setStudentDistance(data.distance);
          toast.error(data.error, { duration: 5000 });
        } else {
          setLocationStatus("idle");
          toast.error(data.error || "Gagal absen");
        }
        setMarking(false);
        return;
      }

      // Sukses
      setLocationStatus("ok");
      setStudentDistance(data.distance);
      toast.success(`Attendance marked: ${statusConfig[status].label} ✅`);
      fetchData();
    } catch {
      setLocationStatus("idle");
      toast.error("Koneksi gagal, coba lagi");
    } finally {
      setMarking(false);
    }
  };

  const handleResetToday = async () => {
    if (!todayAttendance) return;
    if (!confirm("Reset today's attendance? You can re-mark it again.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("attendance").delete().eq("id", todayAttendance.id);
    if (error) toast.error("Failed to reset attendance");
    else { toast.success("Attendance reset. You can mark again."); fetchData(); }
  };

  const handleDeleteRecord = async (id: string, studentName: string) => {
    if (!confirm(`Delete attendance record for ${studentName}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (error) toast.error("Failed to delete record");
    else { toast.success("Record deleted"); fetchData(); }
  };

  const handleChangeStatus = async (id: string, newStatus: AttendanceStatus) => {
    const supabase = createClient();
    const { error } = await supabase.from("attendance")
      .update({ status: newStatus, timestamp: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Failed to update status");
    else { toast.success("Status updated"); fetchData(); }
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

      {/* ══ STUDENT VIEW ══ */}
      {user.role === "student" && (
        <>
          {/* Mark Attendance */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  Today&apos;s Attendance
                </CardTitle>
                {todayAttendance && (
                  <Button variant="ghost" size="sm" onClick={handleResetToday}
                    className="text-gray-500 hover:text-red-600 gap-1 text-xs">
                    <RefreshCw className="w-3 h-3" />Reset
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(todayAttendance.timestamp)}</p>
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

                  {/* Location status indicator */}
                  <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${
                    locationStatus === "ok"
                      ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : locationStatus === "tooFar" || locationStatus === "denied"
                      ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                      : locationStatus === "checking"
                      ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-500"
                  }`}>
                    {locationStatus === "checking" ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium">
                      {locationStatus === "idle" && `Lokasi akan dicek saat kamu absen (maks ${MAX_DISTANCE_METERS}m dari ${SCHOOL_LOCATION_NAME})`}
                      {locationStatus === "checking" && "Mengecek lokasi GPS..."}
                      {locationStatus === "ok" && `✅ Kamu berada di area sekolah (${studentDistance}m)`}
                      {locationStatus === "tooFar" && `❌ Terlalu jauh dari sekolah (${studentDistance}m · maks ${MAX_DISTANCE_METERS}m)`}
                      {locationStatus === "denied" && "❌ Izin lokasi ditolak — aktifkan GPS di browser"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([status, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button key={status} variant="outline" disabled={marking}
                          className={`h-16 flex-col gap-1.5 rounded-xl border-2 transition-all ${
                            status === "present" ? "hover:bg-green-50 hover:border-green-400 dark:hover:bg-green-950" :
                            status === "absent" ? "hover:bg-red-50 hover:border-red-400 dark:hover:bg-red-950" :
                            status === "late" ? "hover:bg-yellow-50 hover:border-yellow-400 dark:hover:bg-yellow-950" :
                            "hover:bg-blue-50 hover:border-blue-400 dark:hover:bg-blue-950"
                          }`}
                          onClick={() => handleMarkAttendance(status)}>
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

          {/* Student Stats */}
          {total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Present", value: presentCount, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
                { label: "Late", value: lateCount, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" },
                { label: "Absent", value: absentCount, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
                { label: "Rate", value: `${attendanceRate}%`, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-sm">
                  <CardContent className={`p-3 text-center rounded-xl ${stat.bg}`}>
                    <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Student History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attendance History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
              ) : attendance.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No attendance records yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendance.map((record) => {
                    const config = statusConfig[record.status as AttendanceStatus];
                    const Icon = config?.icon || CheckCircle;
                    return (
                      <div key={record.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config?.bg}`}>
                          <Icon className={`w-4 h-4 ${config?.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(record.date)}</p>
                          {(record.class as any)?.class_name && (
                            <p className="text-xs text-gray-400">{(record.class as any).class_name}</p>
                          )}
                        </div>
                        <Badge variant={config?.color as any || "secondary"} className="text-xs whitespace-nowrap">
                          {config?.label || record.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ══ TEACHER VIEW ══ */}
      {user.role === "teacher" && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 h-auto">
            <TabsTrigger value="records" className="gap-2 text-sm">
              <UserCheck className="w-4 h-4" />Records
            </TabsTrigger>
            <TabsTrigger value="rekap" className="gap-2 text-sm">
              <TableProperties className="w-4 h-4" />Rekap Kehadiran
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Records ── */}
          <TabsContent value="records" className="mt-4 space-y-4">
            {/* Filters */}
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
              <Button
                onClick={() => setShowManualDialog(true)}
                size="sm"
                className="gap-2 rounded-xl flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                Tambah Manual
              </Button>
            </div>

            {/* Per-class Summary */}
            {classSummaries.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-600" />
                      Summary — {selectedDate}
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSummaryOpen((v) => !v)}>
                      {summaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                {summaryOpen && (
                  <CardContent className="space-y-3">
                    {classSummaries.map((s) => (
                      <div key={s.classId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 dark:text-white truncate">{s.className}</span>
                          <span className="text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                            {s.presentCount}/{s.totalStudents} · <span className={
                              s.rate >= 80 ? "text-green-600 dark:text-green-400 font-semibold" :
                              s.rate >= 60 ? "text-yellow-600 dark:text-yellow-400 font-semibold" :
                              "text-red-600 dark:text-red-400 font-semibold"
                            }>{s.rate}%</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            s.rate >= 80 ? "bg-green-500" : s.rate >= 60 ? "bg-yellow-500" : "bg-red-500"
                          }`} style={{ width: `${s.rate}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Records list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Records ({attendance.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
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
                        <div key={record.id} className="flex items-center gap-2 sm:gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group">
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config?.bg}`}>
                            <Icon className={`w-4 h-4 ${config?.text}`} />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {(record.student as any)?.name || "Student"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {formatDate(record.date)}
                              {(record.class as any)?.class_name && (
                                <span className="hidden sm:inline"> · {(record.class as any).class_name}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <Select value={record.status} onValueChange={(v) => handleChangeStatus(record.id, v as AttendanceStatus)}>
                              <SelectTrigger className="h-8 w-20 sm:w-28 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([s, c]) => (
                                  <SelectItem key={s} value={s} className="text-xs">{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteRecord(record.id, (record.student as any)?.name || "Student")}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Rekap ── */}
          <TabsContent value="rekap" className="mt-4 space-y-4">
            {/* Filter + Export */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Select value={rekapClass} onValueChange={setRekapClass}>
                <SelectTrigger className="w-full sm:w-52 rounded-xl">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleExportRekap}
                disabled={exporting || rekapRows.length === 0}
                size="sm"
                className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl w-full sm:w-auto flex-shrink-0"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Export Excel
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Cari siswa..." value={rekapSearch}
                onChange={(e) => setRekapSearch(e.target.value)} className="pl-9 rounded-xl" />
            </div>

            {/* Content */}
            {rekapLoading ? (
              <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : rekapRows.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Belum ada data kehadiran</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                {(() => {
                  const displayed = rekapRows.filter((r) => r.studentName.toLowerCase().includes(rekapSearch.toLowerCase()));
                  const avgRate = displayed.length > 0 ? Math.round(displayed.reduce((a, b) => a + b.rate, 0) / displayed.length) : 0;
                  const good = displayed.filter((r) => r.rate >= 80).length;
                  const low = displayed.filter((r) => r.rate < 60).length;
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-3 text-center bg-blue-50 dark:bg-blue-950 rounded-xl">
                          <p className="text-xl font-bold text-blue-600">{avgRate}%</p>
                          <p className="text-xs text-gray-500 mt-0.5">Rata-rata</p>
                        </CardContent>
                      </Card>
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-3 text-center bg-green-50 dark:bg-green-950 rounded-xl">
                          <p className="text-xl font-bold text-green-600">{good}</p>
                          <p className="text-xs text-gray-500 mt-0.5">≥80% Baik</p>
                        </CardContent>
                      </Card>
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-3 text-center bg-red-50 dark:bg-red-950 rounded-xl">
                          <p className="text-xl font-bold text-red-600">{low}</p>
                          <p className="text-xs text-gray-500 mt-0.5">&lt;60% Kurang</p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-100 dark:border-gray-700">
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">Nama Siswa</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-green-600">Hadir</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-yellow-600">Terlambat</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-red-600">Absen</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600">Izin</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">Total</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 whitespace-nowrap">Kehadiran</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700">Ket.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {rekapRows
                        .filter((r) => r.studentName.toLowerCase().includes(rekapSearch.toLowerCase()))
                        .map((row, idx) => (
                          <tr key={row.studentId} className="bg-white dark:bg-gray-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors">
                            <td className="px-3 py-3 text-xs text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[10px] font-bold">{getInitials(row.studentName)}</span>
                                </div>
                                <span className="font-medium text-xs text-gray-900 dark:text-white truncate">{row.studentName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center"><span className="text-sm font-semibold text-green-600">{row.present}</span></td>
                            <td className="px-3 py-3 text-center"><span className="text-sm font-semibold text-yellow-600">{row.late}</span></td>
                            <td className="px-3 py-3 text-center"><span className="text-sm font-semibold text-red-600">{row.absent}</span></td>
                            <td className="px-3 py-3 text-center"><span className="text-sm font-semibold text-blue-600">{row.excused}</span></td>
                            <td className="px-3 py-3 text-center"><span className="text-xs text-gray-500">{row.total}</span></td>
                            <td className="px-3 py-3 text-center bg-gray-50/50 dark:bg-gray-800/50">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-sm font-extrabold ${
                                  row.rate >= 80 ? "text-green-600" : row.rate >= 60 ? "text-yellow-600" : "text-red-600"
                                }`}>{row.rate}%</span>
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${
                                    row.rate >= 80 ? "bg-green-500" : row.rate >= 60 ? "bg-yellow-500" : "bg-red-500"
                                  }`} style={{ width: `${row.rate}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center bg-gray-50/50 dark:bg-gray-800/50">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                row.rate >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                row.rate >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                                "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              }`}>
                                {row.rate >= 80 ? "Baik" : row.rate >= 60 ? "Cukup" : "Kurang"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ── Dialog Tambah Record Manual (Guru) ── */}
      {user.role === "teacher" && (
        <Dialog open={showManualDialog} onOpenChange={(open) => {
          setShowManualDialog(open);
          if (!open) {
            setManualForm({ class_id: "", student_id: "", date: new Date().toISOString().split("T")[0], status: "excused" });
            setManualStudents([]);
          }
        }}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Tambah Record Absensi Manual
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                📌 Gunakan untuk input izin, sakit, atau koreksi absensi siswa yang tidak bisa absen sendiri.
              </div>

              {/* Kelas */}
              <div className="space-y-2">
                <Label>Kelas *</Label>
                <Select
                  value={manualForm.class_id}
                  onValueChange={(v) => {
                    setManualForm((prev) => ({ ...prev, class_id: v }));
                    loadManualStudents(v);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Siswa */}
              <div className="space-y-2">
                <Label>Siswa *</Label>
                <Select
                  value={manualForm.student_id}
                  onValueChange={(v) => setManualForm((prev) => ({ ...prev, student_id: v }))}
                  disabled={manualStudents.length === 0}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={manualStudents.length === 0 ? "Pilih kelas dulu..." : "Pilih siswa..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {manualStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal */}
              <div className="space-y-2">
                <Label>Tanggal *</Label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([s, config]) => {
                    const Icon = config.icon;
                    const isSelected = manualForm.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setManualForm((prev) => ({ ...prev, status: s }))}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualDialog(false)} className="rounded-xl">
                Batal
              </Button>
              <Button onClick={handleSaveManual} disabled={savingManual} className="rounded-xl">
                {savingManual ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
