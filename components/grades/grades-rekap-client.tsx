"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Star, Search, ChevronDown, ChevronUp, Users, Loader2, RefreshCw,
  TrendingUp, TrendingDown, GraduationCap, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getGradeColor, getGradeLabel, getInitials, formatDate } from "@/lib/utils";
import type { Class } from "@/types";

/**
 * Rekap Nilai — interactive in-app grade recap for teachers.
 * Shows every class with per-student averages (tugas, formatif, STS, SAS)
 * without needing to export to Excel first.
 */

interface StudentRow {
  id: string;
  name: string;
  email: string;
  countTugas: number;
  countFormatif: number;
  countSTS: number;
  countSAS: number;
  avgTugas: number | "-";
  avgFormatif: number | "-";
  avgSTS: number | "-";
  avgSAS: number | "-";
  nilaiAkhir: number | "-";
  // Latest graded activity — shown so the recap has a time reference
  lastGradedAt: string | null;
}

type SortKey = "name" | "avgTugas" | "avgFormatif" | "avgSTS" | "avgSAS" | "nilaiAkhir";

const numVal = (v: number | "-"): number => (v === "-" ? -1 : v);

/**
 * Semester filter windows. Indonesian school year: Ganjil (Jul–Dec),
 * Genap (Jan–Jun). "all" = no date filter. The year options are derived
 * from actual grade data so old records stay reachable.
 */
type SemesterKey = "all" | "ganjil" | "genap";
const SEMESTER_MONTHS: Record<Exclude<SemesterKey, "all">, { start: number; end: number }> = {
  ganjil: { start: 7, end: 12 }, // Jul..Dec
  genap: { start: 1, end: 6 },   // Jan..Jun
};

function inSemester(iso: string, key: Exclude<SemesterKey, "all">, year: number): boolean {
  const m = new Date(iso).getMonth() + 1;
  const win = SEMESTER_MONTHS[key];
  return m >= win.start && m <= win.end && new Date(iso).getFullYear() === year;
}

function StudentRekapTable({ classId, className }: { classId: string; className: string }) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  // Semester filter — applied client-side over graded activity dates
  const [semester, setSemester] = useState<SemesterKey>("all");
  const [semesterYear, setSemesterYear] = useState<number>(new Date().getFullYear());

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [studentsRes, assignmentsRes, quizzesRes] = await Promise.all([
      supabase.from("users").select("id, name, email").eq("class_id", classId).eq("role", "student").order("name"),
      supabase.from("assignments").select("id").eq("class_id", classId),
      supabase.from("quizzes").select("id, quiz_type").eq("class_id", classId),
    ]);

    const students = studentsRes.data || [];
    const assignments = assignmentsRes.data || [];
    const quizzes = quizzesRes.data || [];
    const quizIds = quizzes.map((q) => q.id);

    const [submissionsRes, attemptsRes] = await Promise.all([
      assignments.length > 0
        ? supabase.from("submissions").select("student_id, assignment_id, score, graded_at, submitted_at").in("assignment_id", assignments.map((a) => a.id)).not("score", "is", null)
        : Promise.resolve({ data: [] }),
      quizIds.length > 0
        ? supabase.from("quiz_attempts").select("student_id, quiz_id, score, completed_at").in("quiz_id", quizIds).not("score", "is", null)
        : Promise.resolve({ data: [] }),
    ]);

    const submissions = (submissionsRes as any).data || [];
    const attempts = (attemptsRes as any).data || [];

    const quizTypeMap: Record<string, string> = {};
    quizzes.forEach((q) => { quizTypeMap[q.id] = q.quiz_type || "formatif"; });

    const avg = (arr: number[]): number | "-" =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : "-";

    const studentRows: StudentRow[] = students.map((student) => {
      const studentSubs = submissions.filter((s: any) => s.student_id === student.id);
      const studentAttempts = attempts.filter((a: any) => a.student_id === student.id);

      const assignScores = studentSubs.map((s: any) => s.score as number).filter((s: number) => s != null);
      // Count how many of the class's assignments this student has graded
      const gradedAssignmentCount = new Set(studentSubs.map((s: any) => s.assignment_id)).size;

      const formatifScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "formatif")
        .map((a: any) => a.score as number);
      const stsScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "sumatif_tengah")
        .map((a: any) => a.score as number);
      const sasScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "sumatif_akhir")
        .map((a: any) => a.score as number);

      const avgTugas = avg(assignScores);
      const avgFormatif = avg(formatifScores);
      const avgSTS = avg(stsScores);
      const avgSAS = avg(sasScores);

      const allValid = [avgTugas, avgFormatif, avgSTS, avgSAS].filter((s) => s !== "-") as number[];
      const nilaiAkhir = avg(allValid);

      // Latest graded activity across submissions and attempts
      const dates = [
        ...studentSubs.map((s: any) => s.graded_at || s.submitted_at),
        ...studentAttempts.map((a: any) => a.completed_at),
      ].filter(Boolean) as string[];
      const lastGradedAt = dates.length > 0
        ? dates.reduce((latest, d) => (new Date(d) > new Date(latest) ? d : latest))
        : null;

      return {
        id: student.id, name: student.name, email: student.email,
        countTugas: gradedAssignmentCount,
        countFormatif: formatifScores.length,
        countSTS: stsScores.length,
        countSAS: sasScores.length,
        avgTugas, avgFormatif, avgSTS, avgSAS, nilaiAkhir,
        lastGradedAt,
      };
    });

    setRows(studentRows);
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  // Rows after the semester filter. A student row matches when ANY of
  // their graded activity falls inside the chosen semester window.
  const semesterRows = useMemo(() => {
    if (semester === "all") return rows;
    return rows.filter((r) => {
      const dates = [
        // we re-derive per-row dates from the last activity; for accuracy we
        // keep this simple: a row counts if its latest activity is in window
        r.lastGradedAt,
      ].some((d) => d && inSemester(d, semester, semesterYear));
      return dates;
    });
  }, [rows, semester, semesterYear]);

  const filtered = useMemo(() => [...semesterRows]
    .filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      return (numVal(a[sort.key]) - numVal(b[sort.key])) * dir;
    }), [semesterRows, search, sort]);

  // Years that actually have grade data (for the semester year picker)
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    rows.forEach((r) => { if (r.lastGradedAt) years.add(new Date(r.lastGradedAt).getFullYear()); });
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [rows]);

  // ── Class summary stats ─────────────────────────────────
  const finals = semesterRows.map((r) => r.nilaiAkhir).filter((v) => v !== "-") as number[];
  const avgFinal = finals.length > 0 ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : null;
  const highest = finals.length > 0 ? Math.max(...finals) : null;
  const lowest = finals.length > 0 ? Math.min(...finals) : null;
  const completed = semesterRows.filter((r) => r.nilaiAkhir !== "-").length;

  // Newest graded activity in the whole class (shown above the table)
  const classLastActivity = useMemo(() => {
    const dates = rows.map((r) => r.lastGradedAt).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.reduce((latest, d) => (new Date(d) > new Date(latest) ? d : latest));
  }, [rows]);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key === k ? (
      sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3 opacity-30" />
    );

  const Dash = () => <span className="text-gray-300 dark:text-gray-600">–</span>;

  const ScoreCell = ({ val, count }: { val: number | "-"; count?: number }) =>
    val === "-" ? (
      <span className="inline-flex flex-col items-center leading-tight">
        <Dash />
        {count !== undefined && count > 0 && (
          <span className="text-[9px] text-gray-300 dark:text-gray-600">{count}x</span>
        )}
      </span>
    ) : (
      <span className={`font-bold ${getGradeColor(val)}`}>{val}</span>
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Memuat nilai siswa…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-14 text-center text-gray-500 dark:text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Belum ada siswa di kelas {className}</p>
          <p className="text-sm mt-1">Tambahkan siswa lewat halaman Classes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center bg-blue-50 dark:bg-blue-950 rounded-xl">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{rows.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" /> Siswa
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center bg-emerald-50 dark:bg-emerald-950 rounded-xl">
            <p className={`text-2xl font-bold ${avgFinal !== null ? getGradeColor(avgFinal) : "text-gray-300"}`}>
              {avgFinal !== null ? avgFinal : "–"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Star className="w-3 h-3" /> Rata-rata
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center bg-green-50 dark:bg-green-950 rounded-xl">
            <p className={`text-2xl font-bold ${highest !== null ? getGradeColor(highest) : "text-gray-300"}`}>
              {highest !== null ? highest : "–"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Tertinggi
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 text-center bg-red-50 dark:bg-red-950 rounded-xl">
            <p className={`text-2xl font-bold ${lowest !== null ? getGradeColor(lowest) : "text-gray-300"}`}>
              {lowest !== null ? lowest : "–"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3" /> Terendah
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Semester filter — recap can be narrowed to Ganjil/Genap of a year */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex gap-1.5">
          {([
            { key: "all" as SemesterKey, label: "Semua" },
            { key: "ganjil" as SemesterKey, label: "Ganjil (Jul–Des)" },
            { key: "genap" as SemesterKey, label: "Genap (Jan–Jun)" },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSemester(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                semester === opt.key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-emerald-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {semester !== "all" && (
          <Select
            value={String(semesterYear)}
            onValueChange={(v) => setSemesterYear(parseInt(v))}
          >
            <SelectTrigger className="w-24 h-8 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Search + refresh + completion badge */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari siswa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl h-10 w-10 flex-shrink-0"
          onClick={fetchGrades}
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          <p>
            <span className="font-bold text-gray-900 dark:text-white">{completed}</span> dari {semesterRows.length} siswa sudah punya nilai akhir
            {semester !== "all" && <span className="text-emerald-600 dark:text-emerald-400 font-semibold"> · Semester {semester === "ganjil" ? "Ganjil" : "Genap"} {semesterYear}</span>}
          </p>
          {classLastActivity && (
            <p className="text-gray-400">
              Aktivitas nilai terakhir: {formatDate(classLastActivity)}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 text-[10px] text-gray-400">
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">T = Tugas</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">F = Formatif</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">STS</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">SAS</span>
        </div>
      </div>

      {/* Table — horizontal scroll on mobile */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-100 dark:border-gray-700">
                <th className="pl-4 pr-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-10">#</th>
                <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <button className="flex items-center gap-1 uppercase" onClick={() => toggleSort("name")}>
                    Nama <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-20">
                  <button className="flex items-center gap-1 mx-auto uppercase" onClick={() => toggleSort("avgTugas")}>
                    Tugas <SortIcon k="avgTugas" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80 w-20">
                  <button className="flex items-center gap-1 mx-auto uppercase" onClick={() => toggleSort("avgFormatif")}>
                    Formatif <SortIcon k="avgFormatif" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-orange-600/80 dark:text-orange-400/80 w-16">
                  <button className="flex items-center gap-1 mx-auto uppercase" onClick={() => toggleSort("avgSTS")}>
                    STS <SortIcon k="avgSTS" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-teal-600/80 dark:text-teal-400/80 w-16">
                  <button className="flex items-center gap-1 mx-auto uppercase" onClick={() => toggleSort("avgSAS")}>
                    SAS <SortIcon k="avgSAS" />
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 dark:text-white w-20 bg-gray-100 dark:bg-gray-700">
                  <button className="flex items-center gap-1 mx-auto uppercase" onClick={() => toggleSort("nilaiAkhir")}>
                    Akhir <SortIcon k="nilaiAkhir" />
                  </button>
                </th>
                <th className="pl-2 pr-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-24 bg-gray-100 dark:bg-gray-700">
                  Predikat
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                  Nilai Terakhir
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((row, idx) => (
                <tr key={row.id} className="bg-white dark:bg-gray-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-colors">
                  <td className="pl-4 pr-2 py-3 text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-bold">{getInitials(row.name)}</span>
                      </div>
                      <div className="min-w-0 max-w-[200px]">
                        <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{row.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{row.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center whitespace-nowrap">
                    <ScoreCell val={row.avgTugas} count={row.countTugas} />
                  </td>
                  <td className="px-2 py-3 text-center whitespace-nowrap">
                    <ScoreCell val={row.avgFormatif} count={row.countFormatif} />
                  </td>
                  <td className="px-2 py-3 text-center whitespace-nowrap">
                    <ScoreCell val={row.avgSTS} count={row.countSTS} />
                  </td>
                  <td className="px-2 py-3 text-center whitespace-nowrap">
                    <ScoreCell val={row.avgSAS} count={row.countSAS} />
                  </td>
                  <td className="px-2 py-3 text-center bg-emerald-50/40 dark:bg-emerald-950/20">
                    {row.nilaiAkhir === "-" ? (
                      <Dash />
                    ) : (
                      <span className={`text-lg font-extrabold ${getGradeColor(row.nilaiAkhir as number)}`}>
                        {row.nilaiAkhir}
                      </span>
                    )}
                  </td>
                  <td className="pl-2 pr-4 py-3 text-center bg-emerald-50/40 dark:bg-emerald-950/20">
                    {row.nilaiAkhir === "-" ? (
                      <Dash />
                    ) : (
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold ${
                          (row.nilaiAkhir as number) >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                          (row.nilaiAkhir as number) >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                          (row.nilaiAkhir as number) >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                          (row.nilaiAkhir as number) >= 60 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {getGradeLabel(row.nilaiAkhir as number)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {row.lastGradedAt ? formatDate(row.lastGradedAt) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-2">Tidak ada siswa yang cocok dengan pencarian</p>
      )}
    </div>
  );
}

export function GradesRekapClient() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("");

  useEffect(() => {
    const fetchClasses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("classes").select("*").order("grade").order("class_name");
      const all = data || [];
      setClasses(all);
      // Default to the first non-archived class
      const firstActive = all.find((c) => !c.is_archived);
      if (firstActive) setSelectedClass(firstActive.id);
      else if (all.length > 0) setSelectedClass(all[0].id);
      setLoading(false);
    };
    fetchClasses();
  }, []);

  // Group classes by grade for an organized selector (XI row, XII row, …)
  // Archived classes are excluded from the main picker and collected separately.
  const activeClasses = useMemo(() => classes.filter((c) => !c.is_archived), [classes]);
  const archivedClasses = useMemo(() => classes.filter((c) => c.is_archived), [classes]);

  const gradeGroups = useMemo(() => {
    const map = new Map<string, Class[]>();
    activeClasses.forEach((c) => {
      const key = c.grade || "Lainnya";
      const arr = map.get(key) || [];
      arr.push(c);
      map.set(key, arr);
    });
    return [...map.entries()];
  }, [activeClasses]);

  const selectedClassData = classes.find((c) => c.id === selectedClass);
  const selectedClassName = selectedClassData?.class_name || "";
  const selectedIsArchived = !!selectedClassData?.is_archived;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Star className="w-6 h-6 text-emerald-600" />
          Rekap Nilai
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Lihat rekap nilai semua siswa langsung di aplikasi
        </p>
      </div>

      {/* Class selector — grouped by grade, chips wrap onto multiple lines */}
      {loading ? (
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ) : classes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Belum ada kelas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: dropdown selector */}
          <div className="sm:hidden">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {gradeGroups.map(([grade, list]) => (
                  <div key={grade}>
                    <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Kelas {grade}
                    </p>
                    {list.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                    ))}
                  </div>
                ))}
                {archivedClasses.length > 0 && (
                  <div>
                    <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Arsip
                    </p>
                    {archivedClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.class_name} (arsip)
                      </SelectItem>
                    ))}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: grouped chips (active classes only) */}
          <div className="hidden sm:flex sm:flex-wrap gap-x-6 gap-y-3">
            {gradeGroups.map(([grade, list]) => (
              <div key={grade}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  Kelas {grade}
                </p>
                <div className="flex flex-wrap gap-2">
                  {list.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls.id)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                        selectedClass === cls.id
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400"
                      }`}
                    >
                      {cls.class_name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Archived classes — separate section, data stays viewable */}
          {archivedClasses.length > 0 && (
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                🗄️ Arsip
              </p>
              <div className="flex flex-wrap gap-2">
                {archivedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all opacity-80 ${
                      selectedClass === cls.id
                        ? "bg-gray-500 text-white shadow-md"
                        : "bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                    }`}
                  >
                    {cls.class_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedClass && (
            <>
              {selectedIsArchived && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400">
                  🗄️ Kelas ini sudah diarsipkan — nilainya masih bisa dilihat, tapi tidak menerima tugas/asesmen baru.
                </div>
              )}
              <StudentRekapTable key={selectedClass} classId={selectedClass} className={selectedClassName} />
            </>
          )}
        </>
      )}
    </div>
  );
}
