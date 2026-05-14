"use client";

import { useEffect, useState } from "react";
import { Star, Search, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatDate, getGradeColor, getGradeLabel } from "@/lib/utils";
import type { User, Submission, Class } from "@/types";

interface GradesClientProps {
  user: User;
}

export function GradesClient({ user }: GradesClientProps) {
  const [grades, setGrades] = useState<Submission[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      if (user.role === "student") {
        const { data } = await supabase
          .from("submissions")
          .select("*, assignment:assignments(title, class_id, class:classes(class_name))")
          .eq("student_id", user.id)
          .not("score", "is", null)
          .order("submitted_at", { ascending: false });
        setGrades(data || []);
      } else {
        const { data } = await supabase
          .from("submissions")
          .select("*, student:users(name, email), assignment:assignments(title, class_id, class:classes(class_name))")
          .not("score", "is", null)
          .order("submitted_at", { ascending: false });
        setGrades(data || []);

        const { data: classData } = await supabase.from("classes").select("*").order("class_name");
        setClasses(classData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user.id, user.role]);

  const filtered = grades.filter((g) => {
    const assignTitle = (g.assignment as any)?.title || "";
    const studentName = (g.student as any)?.name || "";
    const matchSearch =
      assignTitle.toLowerCase().includes(search.toLowerCase()) ||
      studentName.toLowerCase().includes(search.toLowerCase());
    const classId = (g.assignment as any)?.class_id;
    const matchClass = selectedClass === "all" || classId === selectedClass;
    return matchSearch && matchClass;
  });

  const scores = filtered.map((g) => g.score || 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;

  const gradeDistribution = {
    A: scores.filter((s) => s >= 90).length,
    B: scores.filter((s) => s >= 80 && s < 90).length,
    C: scores.filter((s) => s >= 70 && s < 80).length,
    D: scores.filter((s) => s >= 60 && s < 70).length,
    E: scores.filter((s) => s < 60).length,
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // If specific class selected, export just that class
      // If "all", export each class as separate sheet
      const classesToExport = selectedClass !== "all"
        ? classes.filter((c) => c.id === selectedClass)
        : classes;

      // If no classes (student view), export all grades
      if (classesToExport.length === 0) {
        const exportData = filtered.map((g, idx) => ({
          "No": idx + 1,
          "Assignment": (g.assignment as any)?.title || "-",
          "Score": g.score || 0,
          "Grade": getGradeLabel(g.score || 0),
          "Feedback": g.feedback || "-",
          "Date": formatDate(g.submitted_at),
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, "My Grades");
      } else {
        // Export per class as separate sheets
        for (const cls of classesToExport) {
          const classGrades = grades.filter((g) => {
            const classId = (g.assignment as any)?.class_id;
            return classId === cls.id;
          });

          if (classGrades.length === 0) continue;

          const exportData = classGrades.map((g, idx) => ({
            "No": idx + 1,
            "Student Name": (g.student as any)?.name || "-",
            "Email": (g.student as any)?.email || "-",
            "Assignment": (g.assignment as any)?.title || "-",
            "Score": g.score || 0,
            "Grade": getGradeLabel(g.score || 0),
            "Feedback": g.feedback || "-",
            "Date": formatDate(g.submitted_at),
          }));

          const ws = XLSX.utils.json_to_sheet(exportData);
          ws["!cols"] = [
            { wch: 5 }, { wch: 25 }, { wch: 30 },
            { wch: 30 }, { wch: 8 }, { wch: 8 },
            { wch: 30 }, { wch: 15 },
          ];

          // Sheet name max 31 chars
          const sheetName = cls.class_name.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        // Add summary sheet
        const summaryData = classesToExport.map((cls) => {
          const classGrades = grades.filter((g) => (g.assignment as any)?.class_id === cls.id);
          const scores = classGrades.map((g) => g.score || 0);
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return {
            "Class": cls.class_name,
            "Total Records": classGrades.length,
            "Average Score": avg,
            "Highest": scores.length > 0 ? Math.max(...scores) : 0,
            "Lowest": scores.length > 0 ? Math.min(...scores) : 0,
            "Grade A (≥90)": scores.filter((s) => s >= 90).length,
            "Grade B (80-89)": scores.filter((s) => s >= 80 && s < 90).length,
            "Grade C (70-79)": scores.filter((s) => s >= 70 && s < 80).length,
            "Grade D (60-69)": scores.filter((s) => s >= 60 && s < 70).length,
            "Grade E (<60)": scores.filter((s) => s < 60).length,
          };
        });

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary["!cols"] = [
          { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
          { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      }

      const fileName = selectedClass !== "all"
        ? `Grades_${classes.find((c) => c.id === selectedClass)?.class_name}_${new Date().toISOString().split("T")[0]}.xlsx`
        : `Grades_All_Classes_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.role === "teacher" ? "Grade Records" : "My Grades"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} records</p>
        </div>
        {user.role === "teacher" && filtered.length > 0 && (
          <Button
            onClick={handleExportExcel}
            disabled={exporting}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export to Excel"}
          </Button>
        )}
      </div>

      {/* Stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 text-center bg-blue-50 dark:bg-blue-950 rounded-xl">
              <p className={`text-2xl font-bold ${getGradeColor(avgScore)}`}>{avgScore}</p>
              <p className="text-xs text-gray-500">Average</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 text-center bg-green-50 dark:bg-green-950 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{maxScore}</p>
              <p className="text-xs text-gray-500">Highest</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 text-center bg-red-50 dark:bg-red-950 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{minScore}</p>
              <p className="text-xs text-gray-500">Lowest</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 text-center bg-purple-50 dark:bg-purple-950 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">{filtered.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grade Distribution */}
      {filtered.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                    grade === "A" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                    grade === "B" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                    grade === "C" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                    grade === "D" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}>
                    {grade}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search assignment or student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        {user.role === "teacher" && classes.length > 0 && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Grades List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Star className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No grades yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((grade) => (
            <div
              key={grade.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-lg ${
                (grade.score || 0) >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                (grade.score || 0) >= 80 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                (grade.score || 0) >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                (grade.score || 0) >= 60 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}>
                {getGradeLabel(grade.score || 0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {(grade.assignment as any)?.title || "Assignment"}
                  </p>
                  {(grade.assignment as any)?.class?.class_name && (
                    <Badge variant="secondary" className="text-xs">
                      {(grade.assignment as any).class.class_name}
                    </Badge>
                  )}
                </div>
                {user.role === "teacher" && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(grade.student as any)?.name}
                  </p>
                )}
                {grade.feedback && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    💬 {grade.feedback}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(grade.submitted_at)}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`text-2xl font-bold ${getGradeColor(grade.score || 0)}`}>
                  {grade.score}
                </p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
