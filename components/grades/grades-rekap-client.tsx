"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Star, Search, ChevronDown, ChevronUp, Users, Loader2, RefreshCw, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getGradeColor, getGradeLabel, getInitials } from "@/lib/utils";
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
  avgTugas: number | "-";
  avgFormatif: number | "-";
  avgSTS: number | "-";
  avgSAS: number | "-";
  nilaiAkhir: number | "-";
}

type SortKey = "name" | "avgTugas" | "avgFormatif" | "avgSTS" | "avgSAS" | "nilaiAkhir";

const numVal = (v: number | "-"): number => (v === "-" ? -1 : v);

function StudentRekapTable({ classId }: { classId: string }) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

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
        ? supabase.from("submissions").select("student_id, score").in("assignment_id", assignments.map((a) => a.id)).not("score", "is", null)
        : Promise.resolve({ data: [] }),
      quizIds.length > 0
        ? supabase.from("quiz_attempts").select("student_id, quiz_id, score").in("quiz_id", quizIds).not("score", "is", null)
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

      return { id: student.id, name: student.name, email: student.email, avgTugas, avgFormatif, avgSTS, avgSAS, nilaiAkhir };
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

  const filtered = [...rows]
    .filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())
    )
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
      <span className="text-gray-400">—</span>
    ) : (
      <span className={`font-bold ${getGradeColor(val)}`}>{val}</span>
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500 dark:text-gray-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Memuat nilai siswa…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Belum ada siswa di kelas ini</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + sort by final grade */}
      <div className="flex gap-2">
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

      {/* Table — horizontal scroll on mobile */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm -mx-1 px-1">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-100 dark:border-gray-700">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-8">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                <button className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Nama <SortIcon k="name" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgTugas")}>
                  Tugas <SortIcon k="avgTugas" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgFormatif")}>
                  Formatif <SortIcon k="avgFormatif" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgSTS")}>
                  STS <SortIcon k="avgSTS" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("avgSAS")}>
                  SAS <SortIcon k="avgSAS" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap bg-gray-100 dark:bg-gray-700">
                <button className="flex items-center gap-1 mx-auto" onClick={() => toggleSort("nilaiAkhir")}>
                  Akhir <SortIcon k="nilaiAkhir" />
                </button>
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap bg-gray-100 dark:bg-gray-700">
                Predikat
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.map((row, idx) => (
              <tr key={row.id} className="bg-white dark:bg-gray-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-colors">
                <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-[10px] font-bold">{getInitials(row.name)}</span>
                    </div>
                    <div className="min-w-0 max-w-[160px]">
                      <p className="font-medium text-gray-900 dark:text-white truncate text-xs">{row.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{row.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap"><ScoreCell val={row.avgTugas} /></td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap"><ScoreCell val={row.avgFormatif} /></td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap"><ScoreCell val={row.avgSTS} /></td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap"><ScoreCell val={row.avgSAS} /></td>
                <td className="px-3 py-2.5 text-center bg-gray-50/50 dark:bg-gray-800/50">
                  {row.nilaiAkhir === "-" ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className={`text-base font-extrabold ${getGradeColor(row.nilaiAkhir as number)}`}>
                      {row.nilaiAkhir}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center bg-gray-50/50 dark:bg-gray-800/50">
                  {row.nilaiAkhir === "-" ? (
                    <span className="text-gray-400 text-xs">—</span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">Tidak ada siswa yang cocok dengan pencarian</p>
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
      setClasses(data || []);
      if (data && data.length > 0) setSelectedClass(data[0].id);
      setLoading(false);
    };
    fetchClasses();
  }, []);

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

      {/* Class selector */}
      {loading ? (
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ) : classes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Belum ada kelas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  selectedClass === cls.id
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:border-emerald-300"
                }`}
              >
                {cls.class_name}
              </button>
            ))}
          </div>

          {/* Mobile: dropdown selector as well, easier to reach */}
          <div className="sm:hidden">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClass && <StudentRekapTable key={selectedClass} classId={selectedClass} />}
        </>
      )}
    </div>
  );
}
