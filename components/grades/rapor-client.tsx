"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Download, Users, BookOpen, Star, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getGradeLabel } from "@/lib/utils";

interface ClassSummary {
  id: string;
  class_name: string;
  grade: string;
  studentCount: number;
  avgScore: number;
  submissionCount: number;
}

export function RaporClient() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState("2025/2026");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: classData } = await supabase.from("classes").select("*").order("grade").order("class_name");
      if (!classData) { setLoading(false); return; }

      const summaries = await Promise.all(
        classData.map(async (cls) => {
          const { data: students } = await supabase.from("users").select("id", { count: "exact" }).eq("class_id", cls.id).eq("role", "student");
          const { data: submissions } = await supabase
            .from("submissions")
            .select("score, assignment:assignments(class_id)")
            .not("score", "is", null);

          const classSubmissions = (submissions || []).filter((s) => (s.assignment as any)?.class_id === cls.id);
          const scores = classSubmissions.map((s) => s.score || 0);
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

          return {
            id: cls.id,
            class_name: cls.class_name,
            grade: cls.grade,
            studentCount: (students as any)?.length || 0,
            avgScore: avg,
            submissionCount: classSubmissions.length,
          };
        })
      );

      setClasses(summaries);
      setLoading(false);
    };
    fetchData();
  }, []);

  const exportRapor = async (classId: string | "all") => {
    const isAll = classId === "all";
    if (isAll) setExportingAll(true);
    else setExporting(classId);

    try {
      const XLSX = await import("xlsx");
      const supabase = createClient();
      const wb = XLSX.utils.book_new();

      const targetClasses = isAll ? classes : classes.filter((c) => c.id === classId);

      for (const cls of targetClasses) {
        const { data: students } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("class_id", cls.id)
          .eq("role", "student")
          .order("name");

        if (!students || students.length === 0) continue;

        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, title")
          .eq("class_id", cls.id)
          .order("created_at");

        const { data: quizAttempts } = await supabase
          .from("quiz_attempts")
          .select("student_id, score, quiz:quizzes(title, quiz_type, class_id)")
          .not("score", "is", null);

        const { data: submissions } = await supabase
          .from("submissions")
          .select("student_id, score, assignment_id")
          .not("score", "is", null);

        const classAttempts = (quizAttempts || []).filter(
          (a) => (a.quiz as any)?.class_id === cls.id
        );

        const raporData = students.map((student, idx) => {
          const studentSubs = (submissions || []).filter((s) => s.student_id === student.id);
          const assignmentScores = (assignments || []).map((a) => {
            const sub = studentSubs.find((s) => s.assignment_id === a.id);
            return sub?.score ?? "-";
          });
          const validAssignScores = assignmentScores.filter((s) => s !== "-") as number[];
          const avgTugas = validAssignScores.length > 0
            ? Math.round(validAssignScores.reduce((a, b) => a + b, 0) / validAssignScores.length)
            : "-";

          const studentAttempts = classAttempts.filter((a) => a.student_id === student.id);
          const formatifScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "formatif").map((a) => a.score || 0);
          const stsScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "sumatif_tengah").map((a) => a.score || 0);
          const sasScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "sumatif_akhir").map((a) => a.score || 0);

          const avgFormatif = formatifScores.length > 0 ? Math.round(formatifScores.reduce((a, b) => a + b, 0) / formatifScores.length) : "-";
          const avgSTS = stsScores.length > 0 ? Math.round(stsScores.reduce((a, b) => a + b, 0) / stsScores.length) : "-";
          const avgSAS = sasScores.length > 0 ? Math.round(sasScores.reduce((a, b) => a + b, 0) / sasScores.length) : "-";

          const allScores = [avgTugas, avgFormatif, avgSTS, avgSAS].filter((s) => s !== "-") as number[];
          const nilaiAkhir = allScores.length > 0
            ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
            : "-";

          const row: Record<string, any> = {
            "No": idx + 1,
            "Nama Siswa": student.name,
            "Email": student.email,
          };

          (assignments || []).forEach((a, i) => {
            row[`Tugas ${i + 1}`] = assignmentScores[i];
          });

          row["Rata-rata Tugas"] = avgTugas;
          row["Asesmen Formatif"] = avgFormatif;
          row["Sumatif Tengah Semester"] = avgSTS;
          row["Sumatif Akhir Semester"] = avgSAS;
          row["NILAI AKHIR"] = nilaiAkhir;
          row["PREDIKAT"] = nilaiAkhir !== "-" ? getGradeLabel(nilaiAkhir as number) : "-";

          return row;
        });

        const ws = XLSX.utils.json_to_sheet(raporData);
        // Auto column width
        const cols = Object.keys(raporData[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
        ws["!cols"] = cols;

        XLSX.utils.book_append_sheet(wb, ws, cls.class_name.substring(0, 31));
      }

      // Summary sheet
      const summaryData = targetClasses.map((cls) => ({
        "Kelas": cls.class_name,
        "Jumlah Siswa": cls.studentCount,
        "Rata-rata Nilai": cls.avgScore,
        "Total Submission": cls.submissionCount,
        "Predikat Rata-rata": cls.avgScore > 0 ? getGradeLabel(cls.avgScore) : "-",
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Rekap");

      const fileName = isAll
        ? `Rapor_Semua_Kelas_${selectedSemester.replace("/", "-")}.xlsx`
        : `Rapor_${targetClasses[0]?.class_name}_${selectedSemester.replace("/", "-")}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(`Rapor exported: ${fileName}`);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(null);
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            Rapor Export
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Export nilai rapor per kelas ke Excel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSemester} onValueChange={setSelectedSemester}>
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025/2026">2025/2026</SelectItem>
              <SelectItem value="2024/2025">2024/2025</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => exportRapor("all")}
            disabled={exportingAll || loading}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl"
          >
            {exportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Semua
          </Button>
        </div>
      </div>

      {/* Info card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-green-800 dark:text-green-200 font-medium">📊 Format Rapor Excel:</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {["No", "Nama Siswa", "Tugas 1, 2, ...", "Rata-rata Tugas", "Asesmen Formatif", "Sumatif Tengah", "Sumatif Akhir", "NILAI AKHIR", "PREDIKAT"].map((col) => (
              <span key={col} className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-400 border border-green-200 dark:border-green-800">
                {col}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Classes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{cls.grade}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white">{cls.class_name}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />{cls.studentCount} students
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />{cls.submissionCount} submissions
                        </span>
                        {cls.avgScore > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Star className="w-3 h-3" />Avg: {cls.avgScore} ({getGradeLabel(cls.avgScore)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => exportRapor(cls.id)}
                    disabled={exporting === cls.id}
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex-shrink-0"
                  >
                    {exporting === cls.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
