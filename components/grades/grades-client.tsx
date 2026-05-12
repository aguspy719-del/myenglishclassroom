"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, Award, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
        // Teacher: get all graded submissions
        let query = supabase
          .from("submissions")
          .select("*, student:users(name, email), assignment:assignments(title, class_id, class:classes(class_name))")
          .not("score", "is", null)
          .order("submitted_at", { ascending: false });

        const { data } = await query;
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

  // Stats
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {user.role === "teacher" ? "Rekap Nilai" : "Nilai Saya"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {filtered.length} nilai tercatat
        </p>
      </div>

      {/* Stats */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className={`text-2xl font-bold ${getGradeColor(avgScore)}`}>{avgScore}</p>
              <p className="text-xs text-gray-500">Rata-rata</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{maxScore}</p>
              <p className="text-xs text-gray-500">Tertinggi</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-red-600">{minScore}</p>
              <p className="text-xs text-gray-500">Terendah</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
              <p className="text-xs text-gray-500">Total Nilai</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grade Distribution */}
      {filtered.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Distribusi Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    grade === "A" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                    grade === "B" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                    grade === "C" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                    grade === "D" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}>
                    {grade}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{count} siswa</span>
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
            placeholder="Cari tugas atau siswa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {user.role === "teacher" && classes.length > 0 && (
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
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
          <p className="text-lg font-medium">Belum ada nilai</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((grade) => (
            <div
              key={grade.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg ${
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
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {(grade.assignment as any)?.title || "Tugas"}
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
