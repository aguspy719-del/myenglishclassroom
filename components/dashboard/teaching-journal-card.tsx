"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck, Plus, ArrowRight, ChevronUp, ChevronDown,
  Calendar, Users, Lightbulb, Loader2, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { TeachingJournal, Class, User } from "@/types";

const METHOD_LABELS: Record<string, string> = {
  ceramah: "Ceramah",
  diskusi: "Diskusi",
  tanya_jawab: "Tanya Jawab",
  presentasi: "Presentasi",
  demonstrasi: "Demonstrasi",
  game: "Game / Permainan",
  project: "Project Based",
  lainnya: "Lainnya",
};

const METHOD_COLORS: Record<string, string> = {
  ceramah: "bg-blue-50 text-blue-700 border-blue-100",
  diskusi: "bg-purple-50 text-purple-700 border-purple-100",
  tanya_jawab: "bg-amber-50 text-amber-700 border-amber-100",
  presentasi: "bg-teal-50 text-teal-700 border-teal-100",
  demonstrasi: "bg-orange-50 text-orange-700 border-orange-100",
  game: "bg-pink-50 text-pink-700 border-pink-100",
  project: "bg-green-50 text-green-700 border-green-100",
  lainnya: "bg-gray-50 text-gray-700 border-gray-100",
};

interface Props {
  user: User;
}

export function TeachingJournalCard({ user }: Props) {
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    class_id: "",
    date: new Date().toISOString().split("T")[0],
    meeting_number: 1,
    topic: "",
    subtopic: "",
    teaching_method: "ceramah",
    students_present: 0,
    students_absent: 0,
    learning_objectives: "",
    activities: "",
    notes: "",
    reflection: "",
    next_plan: "",
  });

  const supabase = createClient();

  const fetchJournals = async () => {
    const { data } = await supabase
      .from("teaching_journals")
      .select("*, class:classes(class_name, grade)")
      .eq("teacher_id", user.id)
      .order("date", { ascending: false })
      .limit(3);
    setJournals((data as TeachingJournal[]) || []);
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from("classes")
      .select("id, class_name, grade, major")
      .order("grade")
      .order("class_name");
    setClasses((data as Class[]) || []);
  };

  useEffect(() => {
    Promise.all([fetchJournals(), fetchClasses()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!form.class_id) return toast.error("Pilih kelas terlebih dahulu");
    if (!form.topic.trim()) return toast.error("Topik / materi wajib diisi");
    if (!form.learning_objectives.trim()) return toast.error("Tujuan pembelajaran wajib diisi");
    if (!form.activities.trim()) return toast.error("Kegiatan pembelajaran wajib diisi");

    setSubmitting(true);
    const { error } = await supabase.from("teaching_journals").insert([{
      teacher_id: user.id,
      ...form,
      meeting_number: Number(form.meeting_number),
      students_present: Number(form.students_present),
      students_absent: Number(form.students_absent),
    }]);

    if (error) {
      toast.error("Gagal menyimpan jurnal: " + error.message);
    } else {
      toast.success("Jurnal mengajar tersimpan ✅");
      setShowForm(false);
      setForm({
        class_id: "",
        date: new Date().toISOString().split("T")[0],
        meeting_number: 1,
        topic: "",
        subtopic: "",
        teaching_method: "ceramah",
        students_present: 0,
        students_absent: 0,
        learning_objectives: "",
        activities: "",
        notes: "",
        reflection: "",
        next_plan: "",
      });
      fetchJournals();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus entri jurnal ini?")) return;
    const { error } = await supabase.from("teaching_journals").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus jurnal");
    } else {
      toast.success("Jurnal dihapus");
      fetchJournals();
    }
  };

  const field = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-emerald-600" />
          Teaching Journal
        </CardTitle>
        <div className="flex items-center gap-1">
          <Link href="/teaching-journal">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Cancel</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> New Entry</>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Inline create form ── */}
        {showForm && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-2xl space-y-3 border border-emerald-100 dark:border-emerald-900">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
              Entri Jurnal Baru
            </p>

            {/* Row 1: Kelas + Tanggal */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Kelas *</label>
                <select
                  value={form.class_id}
                  onChange={(e) => field("class_id", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih kelas...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Tanggal *</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => field("date", e.target.value)}
                  className="rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Row 2: Pertemuan ke + Metode */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Pertemuan ke</label>
                <Input
                  type="number"
                  min={1}
                  value={form.meeting_number}
                  onChange={(e) => field("meeting_number", e.target.value)}
                  className="rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Metode Mengajar</label>
                <select
                  value={form.teaching_method}
                  onChange={(e) => field("teaching_method", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Hadir + Tidak Hadir */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Siswa Hadir</label>
                <Input
                  type="number"
                  min={0}
                  value={form.students_present}
                  onChange={(e) => field("students_present", e.target.value)}
                  className="rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Siswa Tidak Hadir</label>
                <Input
                  type="number"
                  min={0}
                  value={form.students_absent}
                  onChange={(e) => field("students_absent", e.target.value)}
                  className="rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Topik */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Topik / Materi *</label>
              <Input
                placeholder="Contoh: Simple Present Tense"
                value={form.topic}
                onChange={(e) => field("topic", e.target.value)}
                className="rounded-lg text-sm"
              />
            </div>

            {/* Subtopik */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Sub-topik</label>
              <Input
                placeholder="Contoh: Affirmative & Negative sentences"
                value={form.subtopic}
                onChange={(e) => field("subtopic", e.target.value)}
                className="rounded-lg text-sm"
              />
            </div>

            {/* Tujuan Pembelajaran */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Tujuan Pembelajaran *</label>
              <Textarea
                placeholder="Siswa dapat membuat kalimat Simple Present Tense dengan benar..."
                value={form.learning_objectives}
                onChange={(e) => field("learning_objectives", e.target.value)}
                className="rounded-lg text-sm min-h-[70px] resize-none"
              />
            </div>

            {/* Kegiatan */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Kegiatan Pembelajaran *</label>
              <Textarea
                placeholder="Pendahuluan: review materi sebelumnya (10 mnt)&#10;Inti: penjelasan + latihan soal (60 mnt)&#10;Penutup: kesimpulan dan tugas rumah (10 mnt)"
                value={form.activities}
                onChange={(e) => field("activities", e.target.value)}
                className="rounded-lg text-sm min-h-[80px] resize-none"
              />
            </div>

            {/* Catatan */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Catatan / Hambatan</label>
              <Textarea
                placeholder="Ada beberapa siswa yang belum memahami pola kalimat negatif..."
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
                className="rounded-lg text-sm min-h-[60px] resize-none"
              />
            </div>

            {/* Refleksi */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Refleksi Guru</label>
              <Textarea
                placeholder="Pembelajaran berjalan cukup baik, namun perlu lebih banyak contoh kontekstual..."
                value={form.reflection}
                onChange={(e) => field("reflection", e.target.value)}
                className="rounded-lg text-sm min-h-[60px] resize-none"
              />
            </div>

            {/* Rencana Pertemuan Berikutnya */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600 dark:text-gray-400 font-medium">Rencana Pertemuan Berikutnya</label>
              <Input
                placeholder="Contoh: Present Continuous Tense + latihan speaking"
                value={form.next_plan}
                onChange={(e) => field("next_plan", e.target.value)}
                className="rounded-lg text-sm"
              />
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : (
                <><BookOpenCheck className="w-4 h-4" /> Simpan Jurnal</>
              )}
            </Button>
          </div>
        )}

        {/* ── Journal list (3 terbaru) ── */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : journals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BookOpenCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Belum ada jurnal mengajar</p>
            <p className="text-xs mt-1">Klik &quot;New Entry&quot; untuk mulai mencatat</p>
          </div>
        ) : (
          <div className="space-y-2">
            {journals.map((j) => (
              <div
                key={j.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl group"
              >
                {/* Date badge */}
                <div className="flex-shrink-0 w-10 text-center bg-emerald-100 dark:bg-emerald-900 rounded-lg p-1.5">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase leading-none">
                    {new Date(j.date).toLocaleDateString("id-ID", { month: "short" })}
                  </p>
                  <p className="text-base font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                    {new Date(j.date).getDate()}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{j.topic}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {(j.class as any)?.class_name || "—"}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {j.students_present} hadir
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${METHOD_COLORS[j.teaching_method] || METHOD_COLORS.lainnya}`}>
                      {METHOD_LABELS[j.teaching_method] || j.teaching_method}
                    </span>
                  </div>
                  {j.reflection && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-start gap-1 line-clamp-1">
                      <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-400" />
                      {j.reflection}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={() => handleDelete(j.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
