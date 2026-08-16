"use client";

import { useEffect, useState } from "react";
import {
  Star, Download, Loader2, Search, ChevronDown, ChevronUp, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getGradeColor, getGradeLabel, getInitials } from "@/lib/utils";
import type { Class, User } from "@/types";

interface ClassGradesTabProps {
  classData: Class;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  assignments: Record<string, number | "-">;   // assignment_id → score
  avgTugas: number | "-";
  avgFormatif: number | "-";
  avgSTS: number | "-";
  avgSAS: number | "-";
  nilaiAkhir: number | "-";
}

interface AssignmentCol {
  id: string;
  title: string;
}

type SortKey = "name" | "avgTugas" | "avgFormatif" | "avgSTS" | "avgSAS" | "nilaiAkhir";

export function ClassGradesTab({ classData }: ClassGradesTabProps) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [assignmentCols, setAssignmentCols] = useState<AssignmentCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  useEffect(() => {
    fetchGrades();
  }, [classData.id]);

  const fetchGrades = async () => {
    setLoading(true);
    const supabase = createClient();

    const [studentsRes, assignmentsRes, quizzesRes] = await Promise.all([
      supabase.from("users").select("id, name, email").eq("class_id", classData.id).eq("role", "student").order("name"),
      supabase.from("assignments").select("id, title").eq("class_id", classData.id).order("created_at"),
      supabase.from("quizzes").select("id, quiz_type").eq("class_id", classData.id),
    ]);

    const students = studentsRes.data || [];
    const assignments = assignmentsRes.data || [];
    const quizzes = quizzesRes.data || [];
    const quizIds = quizzes.map((q) => q.id);

    const [submissionsRes, attemptsRes] = await Promise.all([
      supabase.from("submissions").select("student_id, assignment_id, score").in(
        "assignment_id", assignments.length > 0 ? assignments.map((a) => a.id) : ["no-match"]
      ),
      quizIds.length > 0
        ? supabase.from("quiz_attempts").select("student_id, quiz_id, score").in("quiz_id", quizIds).not("score", "is", null)
        : Promise.resolve({ data: [] }),
    ]);

    const submissions = submissionsRes.data || [];
    const attempts = (attemptsRes as any).data || [];

    const quizTypeMap: Record<string, string> = {};
    quizzes.forEach((q) => { quizTypeMap[q.id] = q.quiz_type || "formatif"; });

    const studentRows: StudentRow[] = students.map((student) => {
      const studentSubs = submissions.filter((s) => s.student_id === student.id);
      const studentAttempts = attempts.filter((a: any) => a.student_id === student.id);

      // Assignment scores
      const assignmentScores: Record<string, number | "-"> = {};
      assignments.forEach((a) => {
        const sub = studentSubs.find((s) => s.assignment_id === a.id);
        assignmentScores[a.id] = sub?.score != null ? sub.score : "-";
      });

      const validAssignScores = Object.values(assignmentScores).filter((s) => s !== "-") as number[];
      const avgTugas: number | "-" = validAssignScores.length > 0
        ? Math.round(validAssignScores.reduce((a, b) => a + b, 0) / validAssignScores.length)
        : "-";

      // Quiz scores by type
      const formatifScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "formatif")
        .map((a: any) => a.score as number);
      const stsScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "sumatif_tengah")
        .map((a: any) => a.score as number);
      const sasScores = studentAttempts
        .filter((a: any) => quizTypeMap[a.quiz_id] === "sumatif_akhir")
        .map((a: any) => a.score as number);

      const avg = (arr: number[]): number | "-" =>
        arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : "-";

      const avgFormatif = avg(formatifScores);
      const avgSTS = avg(stsScores);
      const avgSAS = avg(sasScores);

      const allValid = [avgTugas, avgFormatif, avgSTS, avgSAS].filter((s) => s !== "-") as number[];
      const nilaiAkhir: number | "-" = allValid.length > 0
        ? Math.round(allValid.reduce((a, b) => a + b, 0) / allValid.length)
        : "-";

      return { id: student.id, name: student.name, email: student.email, assignments: assignmentScores, avgTugas, avgFormatif, avgSTS, avgSAS, nilaiAkhir };
    });

    setAssignmentCols(assignments.map((a) => ({ id: a.id, title: a.title })));
    setRows(studentRows);
    setLoading(false);
  };

  // ── Sorting ───────────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  const numVal = (v: number | "-"): number => (v === "-" ? -1 : v);

  const sorted = [...rows]
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      return (numVal(a[sort.key]) - numVal(b[sort.key])) * dir;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key === k ? (
      sort.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3 opacity-30" />
    );

  const ScoreCell = ({ val }: { val: number | "-" }) =>
    val === "-" ? (
      <span className="text-gray-400 text-sm">—</span>
    ) : (
      <span className={`text-sm font-bold ${getGradeColor(val)}`}>{val}</span>
    );

  // ── Export Excel ──────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const data = sorted.map((r, idx) => {
        const row: Record<string, any> = {
          No: idx + 1,
          "Nama Siswa": r.name,
          Email: r.email,
        };
        assignmentCols.forEach((a, i) => {
          row[`Tugas ${i + 1}: ${a.title.substring(0, 20)}`] = r.assignments[a.id];
        });
        row["Avg Tugas"] = r.avgTugas;
        row["Asesmen Formatif"] = r.avgFormatif;
        row["Sumatif Tengah (STS)"] = r.avgSTS;
        row["Sumatif Akhir (SAS)"] = r.avgSAS;
        row["NILAI AKHIR"] = r.nilaiAkhir;
        row["PREDIKAT"] = r.nilaiAkhir !== "-" ? getGradeLabel(r.nilaiAkhir as number) : "-";
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const cols = Object.keys(data[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 10) }));
      ws["!cols"] = cols;
      XLSX.utils.book_append_sheet(wb, ws, classData.class_name.substring(0, 31));
      XLSX.writeFile(wb, `Rapor_${classData.class_name}_${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Rapor exported!");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 mt-4">
        <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No students in this class yet</p>
      </div>
    );
  }

  // ── Summary stats ─────────────────────────────────────────
  const validFinals = rows.map((r) => r.nilaiAkhir).filter((v) => v !== "-") as number[];
  const avgFinal = validFinals.length > 0
    ? Math.round(validFinals.reduce((a, b) => a + b, 0) / validFinals.length)
    : null;

  return (
    <div className="space-y-4 mt-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-bold text-gray-900 dark:text-white">{rows.length}</span> siswa
          </p>
          {avgFinal !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded-xl">
              <Star className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Rata-rata kelas: <span className={getGradeColor(avgFinal)}>{avgFinal}</span>
              </span>
            </div>
          )}
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          size="sm"
          className="gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex-shrink-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          Export Excel
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari siswa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Table — horizontal scroll on mobile */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-100 dark:border-gray-700">
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-8">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                <button className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Nama <SortIcon k="name" />
                </button>
              </th>
              {assignmentCols.map((a, i) => (
                <th key={a.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  T{i + 1}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgTugas")}>
                  Avg Tugas <SortIcon k="avgTugas" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgFormatif")}>
                  Formatif <SortIcon k="avgFormatif" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgSTS")}>
                  STS <SortIcon k="avgSTS" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgSAS")}>
                  SAS <SortIcon k="avgSAS" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap bg-gray-100 dark:bg-gray-700">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("nilaiAkhir")}>
                  Nilai Akhir <SortIcon k="nilaiAkhir" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap bg-gray-100 dark:bg-gray-700">
                Predikat
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {sorted.map((row, idx) => (
              <tr
                key={row.id}
                className="bg-white dark:bg-gray-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors"
              >
                <td className="px-3 py-3 text-xs text-gray-400">{idx + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[10px] font-bold">{getInitials(row.name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-xs">{row.name}</p>
                    </div>
                  </div>
                </td>
                {assignmentCols.map((a) => (
                  <td key={a.id} className="px-3 py-3 text-center">
                    <ScoreCell val={row.assignments[a.id]} />
                  </td>
                ))}
                <td className="px-3 py-3 text-center"><ScoreCell val={row.avgTugas} /></td>
                <td className="px-3 py-3 text-center"><ScoreCell val={row.avgFormatif} /></td>
                <td className="px-3 py-3 text-center"><ScoreCell val={row.avgSTS} /></td>
                <td className="px-3 py-3 text-center"><ScoreCell val={row.avgSAS} /></td>
                <td className="px-3 py-3 text-center bg-gray-50/50 dark:bg-gray-800/50">
                  {row.nilaiAkhir === "-" ? (
                    <span className="text-gray-400 text-sm">—</span>
                  ) : (
                    <span className={`text-base font-extrabold ${getGradeColor(row.nilaiAkhir as number)}`}>
                      {row.nilaiAkhir}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center bg-gray-50/50 dark:bg-gray-800/50">
                  {row.nilaiAkhir === "-" ? (
                    <span className="text-gray-400 text-xs">—</span>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      (row.nilaiAkhir as number) >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                      (row.nilaiAkhir as number) >= 80 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                      (row.nilaiAkhir as number) >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                      (row.nilaiAkhir as number) >= 60 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                      "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}>
                      {getGradeLabel(row.nilaiAkhir as number)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Column legend */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-400 dark:text-gray-500">
        {assignmentCols.map((a, i) => (
          <span key={a.id} className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
            T{i + 1} = {a.title.length > 30 ? a.title.substring(0, 30) + "…" : a.title}
          </span>
        ))}
      </div>
    </div>
  );
}
