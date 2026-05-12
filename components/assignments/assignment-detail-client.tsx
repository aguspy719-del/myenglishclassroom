"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clock, Download, Upload, File, X, Loader2,
  CheckCircle, Star, MessageSquare, Users, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDate, formatDateTime, formatFileSize, getDeadlineStatus, getGradeColor, getGradeLabel } from "@/lib/utils";
import type { User, Assignment, Submission } from "@/types";

interface AssignmentDetailClientProps {
  user: User;
  assignment: Assignment;
}

export function AssignmentDetailClient({ user, assignment }: AssignmentDetailClientProps) {
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: "", feedback: "" });

  const deadlineStatus = getDeadlineStatus(assignment.deadline);
  const isPast = deadlineStatus === "overdue";

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      if (user.role === "student") {
        const { data } = await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", assignment.id)
          .eq("student_id", user.id)
          .single();
        setMySubmission(data);
      } else {
        const { data } = await supabase
          .from("submissions")
          .select("*, student:users(name, email)")
          .eq("assignment_id", assignment.id)
          .order("submitted_at", { ascending: false });
        setAllSubmissions(data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [assignment.id, user.id, user.role]);

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Pilih file untuk dikumpulkan");
      return;
    }
    if (isPast) {
      toast.error("Deadline sudah lewat");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${assignment.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("submissions").getPublicUrl(filePath);

      const submissionData = {
        assignment_id: assignment.id,
        student_id: user.id,
        file_url: urlData.publicUrl,
        submitted_at: new Date().toISOString(),
      };

      let error;
      if (mySubmission) {
        ({ error } = await supabase.from("submissions").update(submissionData).eq("id", mySubmission.id));
      } else {
        ({ error } = await supabase.from("submissions").insert([submissionData]));
      }

      if (error) throw error;

      toast.success("Tugas berhasil dikumpulkan!");
      setFile(null);

      // Refresh
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignment.id)
        .eq("student_id", user.id)
        .single();
      setMySubmission(data);
    } catch (err: any) {
      toast.error("Gagal mengumpulkan: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    const score = parseInt(gradeForm.score);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error("Nilai harus antara 0-100");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("submissions")
      .update({ score, feedback: gradeForm.feedback || null })
      .eq("id", submissionId);

    if (error) {
      toast.error("Gagal menyimpan nilai");
    } else {
      toast.success("Nilai berhasil disimpan");
      setGradingId(null);
      setGradeForm({ score: "", feedback: "" });

      const { data } = await supabase
        .from("submissions")
        .select("*, student:users(name, email)")
        .eq("assignment_id", assignment.id)
        .order("submitted_at", { ascending: false });
      setAllSubmissions(data || []);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/assignments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{assignment.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(assignment.class as any)?.class_name && (
              <Badge variant="secondary">{(assignment.class as any).class_name}</Badge>
            )}
            <Badge variant={
              deadlineStatus === "overdue" ? "destructive" :
              deadlineStatus === "today" ? "warning" : "success"
            }>
              {deadlineStatus === "overdue" ? "Deadline Lewat" :
               deadlineStatus === "today" ? "Deadline Hari Ini" : "Aktif"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Assignment Info */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Clock className="w-4 h-4" />
            <span>Deadline: <strong>{formatDateTime(assignment.deadline)}</strong></span>
          </div>

          {assignment.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{assignment.description}</p>
            </div>
          )}

          {assignment.attachment_url && (
            <div className="mt-4">
              <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Soal
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student: Submit Section */}
      {user.role === "student" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {mySubmission ? "Pengumpulan Saya" : "Kumpulkan Tugas"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : mySubmission ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Tugas sudah dikumpulkan</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {formatDateTime(mySubmission.submitted_at)}
                    </p>
                  </div>
                  {mySubmission.file_url && (
                    <a href={mySubmission.file_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        Lihat File
                      </Button>
                    </a>
                  )}
                </div>

                {mySubmission.score !== null && mySubmission.score !== undefined ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <Star className="w-6 h-6 text-yellow-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Nilai: <span className={`text-2xl font-bold ${getGradeColor(mySubmission.score)}`}>
                            {mySubmission.score}
                          </span>
                          <span className="ml-2 text-lg">({getGradeLabel(mySubmission.score)})</span>
                        </p>
                        {mySubmission.feedback && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            💬 {mySubmission.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                    Menunggu penilaian dari guru...
                  </p>
                )}

                {/* Allow resubmission if not past deadline */}
                {!isPast && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Ganti file pengumpulan:</p>
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                          {file ? (
                            <p className="text-sm text-gray-700 dark:text-gray-300">{file.name}</p>
                          ) : (
                            <p className="text-sm text-gray-500">Pilih file baru</p>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                        </div>
                      </label>
                      {file && (
                        <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Ganti
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {isPast && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Deadline sudah lewat. Kamu tidak bisa mengumpulkan tugas.
                  </div>
                )}

                {!isPast && (
                  <>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                      {file ? (
                        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <div className="flex items-center gap-3">
                            <File className="w-5 h-5 text-blue-600" />
                            <div className="text-left">
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Klik untuk pilih file jawaban
                          </p>
                          <p className="text-xs text-gray-400 mt-1">PDF, DOCX, JPG, PNG, MP4. Maks 50MB</p>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f && f.size <= 50 * 1024 * 1024) setFile(f);
                              else if (f) toast.error("File terlalu besar. Maks 50MB");
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={!file || submitting}
                      className="w-full gap-2"
                      size="lg"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Mengumpulkan...</>
                      ) : (
                        <><Upload className="w-4 h-4" />Kumpulkan Tugas</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teacher: Submissions List */}
      {user.role === "teacher" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5" />
              Pengumpulan Siswa ({allSubmissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
              </div>
            ) : allSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Belum ada yang mengumpulkan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allSubmissions.map((sub) => (
                  <div key={sub.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(sub.student as any)?.name || "Siswa"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Dikumpulkan: {formatDateTime(sub.submitted_at)}
                        </p>
                        {sub.score !== null && sub.score !== undefined && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`font-bold ${getGradeColor(sub.score)}`}>{sub.score}</span>
                            <span className="text-xs text-gray-500">({getGradeLabel(sub.score)})</span>
                            {sub.feedback && <span className="text-xs text-gray-500">• {sub.feedback}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.file_url && (
                          <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1">
                              <Download className="w-3 h-3" />
                              File
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant={sub.score !== null ? "secondary" : "default"}
                          onClick={() => {
                            setGradingId(sub.id);
                            setGradeForm({ score: sub.score?.toString() || "", feedback: sub.feedback || "" });
                          }}
                          className="gap-1"
                        >
                          <Star className="w-3 h-3" />
                          {sub.score !== null ? "Edit Nilai" : "Beri Nilai"}
                        </Button>
                      </div>
                    </div>

                    {/* Grading Form */}
                    {gradingId === sub.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nilai (0-100)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="85"
                              value={gradeForm.score}
                              onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Feedback (opsional)</Label>
                            <Input
                              placeholder="Bagus, pertahankan!"
                              value={gradeForm.feedback}
                              onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleGrade(sub.id)} className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Simpan Nilai
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setGradingId(null)}>
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
