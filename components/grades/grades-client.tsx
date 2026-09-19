"use client";

import { useEffect, useState } from "react";
import { Star, Search, FileSpreadsheet, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { fetchWithCache } from "@/lib/offline-cache";
import { toast } from "sonner";
import { formatDate, getGradeColor, getGradeLabel } from "@/lib/utils";
import { AnswerReview } from "@/components/quiz/answer-review";
import { ChevronDown } from "lucide-react";
import type { User, Submission, Class } from "@/types";

interface GradesClientProps {
  user: User;
}

export function GradesClient({ user }: GradesClientProps) {
  const [grades, setGrades] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      if (user.role === "student") {
        // Fetch assignment submissions
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*, assignment:assignments(title, class_id, class:classes(class_name))")
          .eq("student_id", user.id)
          .not("score", "is", null)
          .order("submitted_at", { ascending: false });

        // Fetch quiz attempts — include attempts still waiting for essay grading
        const { data: attemptsData } = await supabase
          .from("quiz_attempts")
          .select("*, quiz:quizzes(id, title, class_id, quiz_type, class:classes(class_name))")
          .eq("student_id", user.id)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false });

        // Normalize to unified format
        const submissionItems = (submissionsData || []).map((s) => ({
          id: s.id,
          score: s.score,
          feedback: s.feedback,
          submitted_at: s.submitted_at,
          type: "assignment" as const,
          title: (s.assignment as any)?.title || "Assignment",
          class_name: (s.assignment as any)?.class?.class_name || "",
          class_id: (s.assignment as any)?.class_id || "",
        }));

        const attemptItems = (attemptsData || []).map((a) => ({
          id: a.id,
          score: a.score,
          feedback: null,
          submitted_at: a.completed_at,
          type: "assessment" as const,
          quiz_type: (a.quiz as any)?.quiz_type || "formatif",
          title: (a.quiz as any)?.title || "Assessment",
          class_name: (a.quiz as any)?.class?.class_name || "",
          class_id: (a.quiz as any)?.class_id || "",
          quiz_id: (a.quiz as any)?.id || a.quiz_id,
          answers: a.answers || null,
          student_id: a.student_id,
        }));

        // Merge and sort by date
        const allGrades = [...submissionItems, ...attemptItems].sort(
          (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
        );

        setGrades(allGrades);

        // Fetch attendance rate
        const { data: attData } = await supabase
          .from("attendance").select("status").eq("student_id", user.id);
        if (attData && attData.length > 0) {
          const presentOrLate = attData.filter((a) => a.status === "present" || a.status === "late").length;
          setAttendanceRate(Math.round((presentOrLate / attData.length) * 100));
        } else {
          setAttendanceRate(null);
        }
      } else {
        const { data } = await supabase
          .from("submissions")
          .select("*, student:users(name, email), assignment:assignments(title, class_id, class:classes(class_name))")
          .not("score", "is", null)
          .order("submitted_at", { ascending: false });
        setGrades((data || []).map((s) => ({
          ...s,
          type: "assignment",
          title: (s.assignment as any)?.title || "Assignment",
          class_name: (s.assignment as any)?.class?.class_name || "",
          class_id: (s.assignment as any)?.class_id || "",
        })));

        const { data: classData } = await supabase.from("classes").select("*").order("class_name");
        setClasses(classData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user.id, user.role]);

  const filtered = grades.filter((g) => {
    const title = g.title || "";
    const studentName = (g.student as any)?.name || "";
    const matchSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      studentName.toLowerCase().includes(search.toLowerCase());
    const matchClass = selectedClass === "all" || g.class_id === selectedClass;
    return matchSearch && matchClass;
  });

  const scored = filtered.filter((g) => g.score !== null && g.score !== undefined);
  const scores = scored.map((g) => g.score);
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
      const supabase = createClient();

      const classesToExport = selectedClass !== "all"
        ? classes.filter((c) => c.id === selectedClass)
        : classes;

      for (const cls of classesToExport) {
        // Get all students in this class
        const { data: students } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("class_id", cls.id)
          .eq("role", "student")
          .order("name");

        if (!students || students.length === 0) continue;

        // Get all assignments for this class
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, title")
          .eq("class_id", cls.id)
          .order("created_at");

        // Get quiz attempts per type for this class
        const { data: quizAttempts } = await supabase
          .from("quiz_attempts")
          .select("student_id, score, quiz:quizzes(title, quiz_type)")
          .eq("quizzes.class_id", cls.id)
          .not("score", "is", null);

        // Get submissions for this class
        const { data: submissions } = await supabase
          .from("submissions")
          .select("student_id, score, assignment_id")
          .not("score", "is", null);

        // Build rapor rows
        const raporData = students.map((student, idx) => {
          // Assignment scores
          const studentSubs = (submissions || []).filter((s) => s.student_id === student.id);
          const assignmentScores = (assignments || []).map((a) => {
            const sub = studentSubs.find((s) => s.assignment_id === a.id);
            return sub?.score ?? "-";
          });
          const assignmentAvg = assignmentScores.filter((s) => s !== "-").length > 0
            ? Math.round((assignmentScores.filter((s) => s !== "-") as number[]).reduce((a, b) => a + b, 0) / assignmentScores.filter((s) => s !== "-").length)
            : "-";

          // Quiz scores by type
          const studentAttempts = (quizAttempts || []).filter((a) => a.student_id === student.id);
          const formatifScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "formatif").map((a) => a.score || 0);
          const stsScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "sumatif_tengah").map((a) => a.score || 0);
          const sasScores = studentAttempts.filter((a) => (a.quiz as any)?.quiz_type === "sumatif_akhir").map((a) => a.score || 0);

          const avgFormatif = formatifScores.length > 0 ? Math.round(formatifScores.reduce((a, b) => a + b, 0) / formatifScores.length) : "-";
          const avgSTS = stsScores.length > 0 ? Math.round(stsScores.reduce((a, b) => a + b, 0) / stsScores.length) : "-";
          const avgSAS = sasScores.length > 0 ? Math.round(sasScores.reduce((a, b) => a + b, 0) / sasScores.length) : "-";

          // Final grade calculation
          const validScores = [assignmentAvg, avgFormatif, avgSTS, avgSAS].filter((s) => s !== "-") as number[];
          const finalGrade = validScores.length > 0
            ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
            : "-";

          const row: Record<string, any> = {
            "No": idx + 1,
            "Student Name": student.name,
            "Email": student.email,
          };

          // Add assignment columns
          (assignments || []).forEach((a, i) => {
            row[`Tugas ${i + 1}: ${a.title.substring(0, 20)}`] = assignmentScores[i];
          });
          row["Avg Tugas"] = assignmentAvg;
          row["Asesmen Formatif"] = avgFormatif;
          row["Sumatif Tengah Semester"] = avgSTS;
          row["Sumatif Akhir Semester"] = avgSAS;
          row["NILAI AKHIR"] = finalGrade;
          row["PREDIKAT"] = finalGrade !== "-" ? getGradeLabel(finalGrade as number) : "-";

          return row;
        });

        const ws = XLSX.utils.json_to_sheet(raporData);
        const sheetName = cls.class_name.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Summary sheet
      if (classesToExport.length > 1) {
        const summaryData = classesToExport.map((cls) => {
          const classGrades = grades.filter((g) => (g.assignment as any)?.class_id === cls.id);
          const scores = classGrades.map((g) => g.score || 0);
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return {
            "Class": cls.class_name,
            "Total Submissions": classGrades.length,
            "Average Score": avg,
            "Highest": scores.length > 0 ? Math.max(...scores) : 0,
            "Lowest": scores.length > 0 ? Math.min(...scores) : 0,
          };
        });
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      }

      const fileName = selectedClass !== "all"
        ? `Rapor_${classes.find((c) => c.id === selectedClass)?.class_name}_${new Date().toISOString().split("T")[0]}.xlsx`
        : `Rapor_Semua_Kelas_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("Rapor Excel exported successfully!");
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.role === "teacher" ? "Grade Records" : "My Grades"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} records</p>
        </div>
        {user.role === "teacher" && (
          <Button
            onClick={handleExportExcel}
            disabled={exporting}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export Rapor Excel"}
          </Button>
        )}
      </div>

      {/* Stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4 text-center bg-emerald-50 dark:bg-emerald-950 rounded-xl">
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
            <CardContent className="pt-4 pb-4 text-center bg-teal-50 dark:bg-teal-950 rounded-xl">
              <p className="text-2xl font-bold text-teal-600">{filtered.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student: Attendance Rate summary card */}
      {user.role === "student" && filtered.length > 0 && attendanceRate !== null && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Attendance Rate</p>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      attendanceRate >= 80 ? "bg-green-500" :
                      attendanceRate >= 60 ? "bg-yellow-500" :
                      "bg-red-500"
                    }`}
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
              <p className={`text-xl font-bold flex-shrink-0 ${
                attendanceRate >= 80 ? "text-green-600 dark:text-green-400" :
                attendanceRate >= 60 ? "text-yellow-600 dark:text-yellow-400" :
                "text-red-600 dark:text-red-400"
              }`}>
                {attendanceRate}%
              </p>
            </div>
          </CardContent>
        </Card>
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
                    grade === "B" ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" :
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
            placeholder={user.role === "teacher" ? "Search assignment or student..." : "Search assignment..."}
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
            <GradeRow key={grade.id} grade={grade} userRole={user.role} userId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One row in the grades list — assessments expand into an answer review */
function GradeRow({ grade, userRole, userId }: {
  grade: any;
  userRole: string;
  userId: string;
}) {
  const quizTypeLabels: Record<string, string> = {
    formatif: "Formatif",
    sumatif_tengah: "STS",
    sumatif_akhir: "SAS",
  };
  const quizTypeColors: Record<string, string> = {
    formatif: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    sumatif_tengah: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    sumatif_akhir: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  };
  // Review state — only assessment rows with a final score can expand
  const canReview = grade.type === "assessment" && grade.score != null;
  const [expanded, setExpanded] = useState(false);
  const [questions, setQuestions] = useState<any[] | null>(null);
  const [essayAnswers, setEssayAnswers] = useState<any[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  const loadReview = async () => {
    setLoadingReview(true);
    try {
      const supabase = createClient();
      const studentId = grade.student_id || userId;
      const [q, ea] = await Promise.all([
        supabase.from("quiz_questions").select("*").eq("quiz_id", grade.quiz_id).order("order_number"),
        supabase.from("essay_answers").select("*, question:quiz_questions(question, max_score)")
          .eq("quiz_id", grade.quiz_id).eq("student_id", studentId)
          .order("submitted_at", { ascending: false }),
      ]);
      setQuestions(q.data || []);
      setEssayAnswers(ea.data || []);
    } catch {
      // leave review empty on failure
    }
    setLoadingReview(false);
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && questions === null) loadReview();
  };

  return (
    <div className="space-y-2">
      <div
        role={canReview ? "button" : undefined}
        onClick={canReview ? toggle : undefined}
        className={`flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm ${
          canReview ? "cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors" : ""
        }`}
      >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-base ${
                  grade.score == null ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" :
                  (grade.score) >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  (grade.score) >= 80 ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" :
                  (grade.score) >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                  (grade.score) >= 60 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                  "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}>
                  {grade.score == null ? "⏳" : getGradeLabel(grade.score)}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {grade.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {/* Type badge */}
                    {grade.type === "assessment" ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quizTypeColors[grade.quiz_type] || quizTypeColors.formatif}`}>
                        {quizTypeLabels[grade.quiz_type] || "Assessment"}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Tugas
                      </span>
                    )}
                    {grade.class_name && (
                      <Badge variant="secondary" className="text-xs">{grade.class_name}</Badge>
                    )}
                  </div>
                  {userRole === "teacher" && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {(grade.student as any)?.name}
                    </p>
                  )}
                  {grade.feedback && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      💬 {grade.feedback}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(grade.submitted_at)}</p>
                </div>

                <div className="text-right flex-shrink-0 ml-1 flex items-center gap-1.5">
                  {grade.score == null ? (
                    <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                      ⏳ Pending grade
                    </p>
                  ) : (
                    <>
                      <p className={`text-xl font-bold ${getGradeColor(grade.score)}`}>
                        {grade.score}
                      </p>
                      <p className="text-xs text-gray-400">/ 100</p>
                    </>
                  )}
                  {canReview && (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </div>

              {/* Answer review — expandable under the row */}
              {canReview && expanded && (
                <div className="pl-1 pr-1 pb-1">
                  {loadingReview ? (
                    <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ) : questions && questions.length > 0 ? (
                    <AnswerReview
                      questions={questions}
                      answers={(grade.answers as Record<string, string>) || {}}
                      essaySlot={(qId: string) => {
                        const ea = essayAnswers.find((a) => a.question_id === qId);
                        return ea ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                              <p className="text-[11px] font-semibold text-gray-500 mb-1">Answer:</p>
                              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">{ea.answer}</p>
                            </div>
                            {ea.score != null && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  Score: {ea.score}/{(ea.question as any)?.max_score || 10}
                                </Badge>
                                {ea.feedback && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">“{ea.feedback}”</p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">(no answer)</p>
                        );
                      }}
                    />
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">Answer details unavailable for this attempt.</p>
                  )}
                </div>
              )}
            </div>
  );
}
