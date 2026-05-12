"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, ClipboardList, Users, UserCheck, Star, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { User, Class, Material, Assignment } from "@/types";

interface ClassDetailClientProps {
  user: User;
  classData: Class;
}

export function ClassDetailClient({ user, classData }: ClassDetailClientProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [matsRes, assignsRes, studentsRes] = await Promise.all([
        supabase.from("materials").select("*").eq("class_id", classData.id).order("created_at", { ascending: false }),
        supabase.from("assignments").select("*").eq("class_id", classData.id).order("deadline", { ascending: true }),
        supabase.from("users").select("*").eq("class_id", classData.id).eq("role", "student"),
      ]);
      setMaterials(matsRes.data || []);
      setAssignments(assignsRes.data || []);
      setStudents(studentsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [classData.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/classes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{classData.class_name}</h1>
            <Badge variant="info">Kelas {classData.grade}</Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400">{classData.major}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{students.length}</p>
            <p className="text-xs text-gray-500">Siswa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{materials.length}</p>
            <p className="text-xs text-gray-500">Materi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{assignments.length}</p>
            <p className="text-xs text-gray-500">Tugas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="materials">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="materials" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Materi
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Tugas
          </TabsTrigger>
          {user.role === "teacher" && (
            <TabsTrigger value="students" className="gap-2">
              <Users className="w-4 h-4" />
              Siswa
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="materials" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Materi Pelajaran</h3>
            {user.role === "teacher" && (
              <Link href={`/materials/upload?class=${classData.id}`}>
                <Button size="sm" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Upload Materi
                </Button>
              </Link>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Belum ada materi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((mat) => (
                <div key={mat.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{mat.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {mat.topic && `${mat.topic} • `}
                        {mat.meeting && `Pertemuan ${mat.meeting} • `}
                        {formatDate(mat.created_at)}
                      </p>
                    </div>
                  </div>
                  {mat.file_url && (
                    <a href={mat.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">Download</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Daftar Tugas</h3>
            {user.role === "teacher" && (
              <Link href={`/assignments/create?class=${classData.id}`}>
                <Button size="sm" className="gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Buat Tugas
                </Button>
              </Link>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Belum ada tugas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assign) => {
                const isPast = new Date(assign.deadline) < new Date();
                return (
                  <Link key={assign.id} href={`/assignments/${assign.id}`}>
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{assign.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Deadline: {formatDate(assign.deadline)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={isPast ? "destructive" : "success"}>
                        {isPast ? "Lewat" : "Aktif"}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {user.role === "teacher" && (
          <TabsContent value="students" className="mt-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Daftar Siswa</h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Belum ada siswa terdaftar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {students.map((student, idx) => (
                  <div key={student.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{student.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
