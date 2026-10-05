"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpenCheck, Plus, Search, Trash2, ChevronDown,
  ChevronUp, Calendar, Users, Lightbulb, NotebookPen, Loader2,
  FileDown, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

const EMPTY_FORM = {
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
};

interface Props { user: User }

export function TeachingJournalClient({ user }: Props) {
  const supabase = createClient();

  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  // Form
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchAll = useCallback(async () => {
    const [journalsRes, classesRes] = await Promise.all([
      supabase
        .from("teaching_journals")
        .select("*, class:classes(class_name, grade)")
        .eq("teacher_id", user.id)
        .order("date", { ascending: false }),
      supabase.from("classes").select("id, class_name, grade, major").order("grade").order("class_name"),
    ]);
    setJournals((journalsRes.data as TeachingJournal[]) || []);
    setClasses((classesRes.data as Class[]) || []);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const field = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

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
      toast.error("Gagal menyimpan: " + error.message);
    } else {
      toast.success("Jurnal mengajar tersimpan ✅");
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      fetchAll();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus entri jurnal ini?")) return;
    const { error } = await supabase.from("teaching_journals").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus");
    else { toast.success("Jurnal dihapus"); fetchAll(); }
  };

  // Export to CSV
  const handleExport = () => {
    const rows = filtered.map((j) => [
      j.date,
      (j.class as any)?.class_name || "",
      j.meeting_number,
      j.topic,
      j.subtopic || "",
      METHOD_LABELS[j.teaching_method] || j.teaching_method,
      j.students_present,
      j.students_absent,
      j.learning_objectives.replace(/\n/g, " "),
      j.activities.replace(/\n/g, " "),
      (j.notes || "").replace(/\n/g, " "),
      (j.reflection || "").replace(/\n/g, " "),
      (j.next_plan || "").replace(/\n/g, " "),
    ]);

    const header = [
      "Tanggal", "Kelas", "Pertemuan Ke", "Topik", "Sub-topik",
      "Metode", "Hadir", "Tidak Hadir", "Tujuan Pembelajaran",
      "Kegiatan", "Catatan/Hambatan", "Refleksi", "Rencana Berikutnya",
    ];

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jurnal-mengajar-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Jurnal diekspor ke CSV");
  };

  // Filter
  const filtered = journals.filter((j) => {
    const matchSearch = !search ||
      j.topic.toLowerCase().includes(search.toLowerCase()) ||
      (j.subtopic || "").toLowerCase().includes(search.toLowerCase()) ||
      (j.reflection || "").toLowerCase().includes(search.toLowerCase());
    const matchClass = !filterClass || j.class_id === filterClass;
    const matchMonth = !filterMonth || j.date.startsWith(filterMonth);
    return matchSearch && matchClass && matchMonth;
  });

  // Unique months for filter dropdown
  const months = [...new Set(journals.map((j) => j.date.slice(0, 7)))].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <NotebookPen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">Teaching Journal</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{journals.length} entri jurnal mengajar</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleExport}>
              <FileDown className="w-4 h-4" /> Export CSV
            </Button>
          )}
          <Button
            size="sm"
            className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={() => { setShowForm((v) => !v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          >
            {showForm ? <><X className="w-4 h-4" /> Batal</> : <><Plus className="w-4 h-4" /> Entri Baru</>}
          </Button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4" /> Entri Jurnal Baru
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Kelas *</label>
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
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tanggal *</label>
                <Input type="date" value={form.date} onChange={(e) => field("date", e.target.value)} className="rounded-lg text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Pertemuan ke</label>
                <Input type="number" min={1} value={form.meeting_number} onChange={(e) => field("meeting_number", e.target.value)} className="rounded-lg text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Metode Mengajar</label>
                <select
                  value={form.teaching_method}
                  onChange={(e) => field("teaching_method", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Siswa Hadir</label>
                <Input type="number" min={0} value={form.students_present} onChange={(e) => field("students_present", e.target.value)} className="rounded-lg text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Siswa Tidak Hadir</label>
                <Input type="number" min={0} value={form.students_absent} onChange={(e) => field("students_absent", e.target.value)} className="rounded-lg text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Topik / Materi *</label>
              <Input placeholder="Contoh: Simple Present Tense" value={form.topic} onChange={(e) => field("topic", e.target.value)} className="rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sub-topik</label>
              <Input placeholder="Contoh: Affirmative & Negative sentences" value={form.subtopic} onChange={(e) => field("subtopic", e.target.value)} className="rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tujuan Pembelajaran *</label>
              <Textarea placeholder="Siswa dapat membuat kalimat Simple Present Tense dengan benar..." value={form.learning_objectives} onChange={(e) => field("learning_objectives", e.target.value)} className="rounded-lg text-sm min-h-[70px] resize-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Kegiatan Pembelajaran *</label>
              <Textarea placeholder="Pendahuluan: ... (10 mnt)&#10;Inti: ... (60 mnt)&#10;Penutup: ... (10 mnt)" value={form.activities} onChange={(e) => field("activities", e.target.value)} className="rounded-lg text-sm min-h-[80px] resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Catatan / Hambatan</label>
                <Textarea placeholder="Kendala yang ditemui saat mengajar..." value={form.notes} onChange={(e) => field("notes", e.target.value)} className="rounded-lg text-sm min-h-[80px] resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Refleksi Guru</label>
                <Textarea placeholder="Penilaian diri atas proses pembelajaran hari ini..." value={form.reflection} onChange={(e) => field("reflection", e.target.value)} className="rounded-lg text-sm min-h-[80px] resize-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Rencana Pertemuan Berikutnya</label>
              <Input placeholder="Contoh: Present Continuous Tense + latihan speaking" value={form.next_plan} onChange={(e) => field("next_plan", e.target.value)} className="rounded-lg text-sm" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><BookOpenCheck className="w-4 h-4" /> Simpan Jurnal</>}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari topik, refleksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl text-sm"
          />
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Semua kelas</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Semua bulan</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      {/* Stats bar */}
      {journals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Entri", value: journals.length, color: "text-emerald-600" },
            { label: "Hasil Filter", value: filtered.length, color: "text-teal-600" },
            { label: "Kelas Berbeda", value: new Set(journals.map((j) => j.class_id)).size, color: "text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 text-center shadow-sm">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Journal entries */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <NotebookPen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500">
            {journals.length === 0 ? "Belum ada jurnal mengajar" : "Tidak ada jurnal yang cocok dengan filter"}
          </p>
          {journals.length === 0 && (
            <p className="text-sm mt-1">Klik &quot;Entri Baru&quot; untuk mulai mencatat</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((j) => {
            const isExpanded = expandedId === j.id;
            const className = (j.class as any)?.class_name || "—";
            return (
              <Card key={j.id} className="overflow-hidden">
                {/* Summary row — always visible */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : j.id)}
                >
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-12 text-center bg-emerald-50 dark:bg-emerald-950 rounded-xl p-2">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                      {new Date(j.date).toLocaleDateString("id-ID", { month: "short" })}
                    </p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                      {new Date(j.date).getDate()}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(j.date).getFullYear()}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{j.topic}</p>
                      {j.subtopic && (
                        <span className="text-xs text-gray-400">· {j.subtopic}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {className}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {j.students_present} hadir · {j.students_absent} absen
                      </span>
                      <span className="text-xs text-gray-500">Pertemuan {j.meeting_number}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${METHOD_COLORS[j.teaching_method] || METHOD_COLORS.lainnya}`}>
                        {METHOD_LABELS[j.teaching_method] || j.teaching_method}
                      </span>
                    </div>
                    {j.reflection && !isExpanded && (
                      <p className="text-xs text-gray-400 mt-1.5 flex items-start gap-1 line-clamp-1">
                        <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-400" />
                        {j.reflection}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={(e) => { e.stopPropagation(); handleDelete(j.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
                    <DetailSection label="Tujuan Pembelajaran" text={j.learning_objectives} icon="🎯" />
                    <DetailSection label="Kegiatan Pembelajaran" text={j.activities} icon="📋" />
                    {j.notes && <DetailSection label="Catatan / Hambatan" text={j.notes} icon="⚠️" />}
                    {j.reflection && <DetailSection label="Refleksi Guru" text={j.reflection} icon="💡" />}
                    {j.next_plan && <DetailSection label="Rencana Pertemuan Berikutnya" text={j.next_plan} icon="📅" />}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailSection({ label, text, icon }: { label: string; text: string; icon: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
        <span>{icon}</span> {label}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
        {text}
      </p>
    </div>
  );
}
