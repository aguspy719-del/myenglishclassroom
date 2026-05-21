"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Clock, Trash2, Search, CheckSquare, Square, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { User, Quiz, Class } from "@/types";

interface QuizClientProps {
  user: User;
}

const QUIZ_TYPES = [
  { value: "formatif", label: "Asesmen Formatif", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", short: "Formatif" },
  { value: "sumatif_tengah", label: "Asesmen Sumatif Tengah Semester", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", short: "STS" },
  { value: "sumatif_akhir", label: "Asesmen Sumatif Akhir Semester", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", short: "SAS" },
];

export function QuizClient({ user }: QuizClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    time_limit: "",
    quiz_type: "formatif",
    published_at: "",
  });

  const fetchData = async () => {
    const supabase = createClient();
    let query = supabase
      .from("quizzes")
      .select("*, class:classes(class_name)")
      .order("created_at", { ascending: false });

    if (user.role === "student" && user.class_id) {
      query = query
        .eq("class_id", user.class_id)
        .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);
    }

    const [quizzesRes, classesRes] = await Promise.all([
      query,
      supabase.from("classes").select("*").order("grade").order("class_name"),
    ]);

    setQuizzes(quizzesRes.data || []);
    setClasses(classesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const toggleAll = () => {
    setSelectedClasses(selectedClasses.length === classes.length ? [] : classes.map((c) => c.id));
  };

  const handleCreate = async () => {
    if (selectedClasses.length === 0) { toast.error("Select at least one class"); return; }
    if (!form.title) { toast.error("Assessment title is required"); return; }

    setCreating(true);
    const supabase = createClient();

    const insertData = selectedClasses.map((classId) => ({
      class_id: classId,
      title: form.title,
      description: form.description || null,
      time_limit: form.time_limit ? parseInt(form.time_limit) : null,
      quiz_type: form.quiz_type,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    }));

    const { error } = await supabase.from("quizzes").insert(insertData);

    if (error) {
      toast.error("Failed to Create Assessment");
    } else {
      // Push notification to students (only if publishing now, not scheduled)
      const isPublishingNow = !form.published_at || new Date(form.published_at) <= new Date();
      if (isPublishingNow) {
        try {
          const { data: students } = await supabase
            .from("users")
            .select("id")
            .in("class_id", selectedClasses)
            .eq("role", "student");
          if (students && students.length > 0) {
            await fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userIds: students.map((s) => s.id),
                payload: {
                  title: "📝 New Assessment",
                  body: form.title,
                  url: "/quiz",
                },
              }),
            });
          }
        } catch { /* push failure should not block */ }
      }

      const scheduled = form.published_at && new Date(form.published_at) > new Date();
      toast.success(
        scheduled
          ? `Assessment scheduled for ${new Date(form.published_at).toLocaleString()}`
          : selectedClasses.length === 1
            ? "Assessment created successfully!"
            : `Assessment created for ${selectedClasses.length} classes!`
      );
      setShowCreate(false);
      setSelectedClasses([]);
      setForm({ title: "", description: "", time_limit: "", quiz_type: "formatif", published_at: "" });
      fetchData();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete assessment "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Assessment deleted"); fetchData(); }
  };

  const minDateTime = new Date().toISOString().slice(0, 16);
  const gradeXI = classes.filter((c) => c.grade === "XI");
  const gradeXII = classes.filter((c) => c.grade === "XII");

  const getQuizTypeConfig = (type: string) => QUIZ_TYPES.find((t) => t.value === type) || QUIZ_TYPES[0];

  const isScheduled = (quiz: any) => quiz.published_at && new Date(quiz.published_at) > new Date();

  const filtered = quizzes.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || (q as any).quiz_type === activeTab;
    return matchSearch && matchTab;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Assessment</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} available</p>
        </div>
        {user.role === "teacher" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Assessment
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search assessment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Tabs by type */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1 p-1 overflow-x-auto">
          <TabsTrigger value="all" className="text-xs flex-shrink-0">All</TabsTrigger>
          <TabsTrigger value="formatif" className="text-xs flex-shrink-0">Formatif</TabsTrigger>
          <TabsTrigger value="sumatif_tengah" className="text-xs flex-shrink-0">STS</TabsTrigger>
          <TabsTrigger value="sumatif_akhir" className="text-xs flex-shrink-0">SAS</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No assessments yet</p>
              {user.role === "teacher" && (
                <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />Create First Assessment
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((quiz) => {
                const typeConfig = getQuizTypeConfig((quiz as any).quiz_type || "formatif");
                const scheduled = isScheduled(quiz);
                return (
                  <Card key={quiz.id} className="hover:shadow-md transition-shadow group border-0 shadow-sm">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeConfig.color}`}>
                          {typeConfig.short}
                        </div>
                        {user.role === "teacher" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDelete(quiz.id, quiz.title)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{quiz.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        {(quiz.class as any)?.class_name && (
                          <Badge variant="secondary" className="text-xs">{(quiz.class as any).class_name}</Badge>
                        )}
                        {quiz.time_limit && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />{quiz.time_limit} min
                          </span>
                        )}
                        {scheduled && (
                          <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <Calendar className="w-3 h-3" />Scheduled
                          </span>
                        )}
                      </div>
                      <Link href={`/quiz/${quiz.id}`}>
                        <Button className="w-full rounded-xl" size="sm" disabled={scheduled && user.role === "student"}>
                          {user.role === "teacher" ? "Manage" : scheduled ? "Not Available Yet" : "Start Assessment"}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) {
          setSelectedClasses([]);
          setForm({ title: "", description: "", time_limit: "", quiz_type: "formatif", published_at: "" });
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Assessment Type */}
            <div className="space-y-2">
              <Label>Assessment Type *</Label>
              <div className="grid grid-cols-1 gap-2">
                {QUIZ_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, quiz_type: type.value })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                      form.quiz_type === type.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0",
                      form.quiz_type === type.value ? "border-blue-500 bg-blue-500" : "border-gray-300"
                    )} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{type.label}</p>
                    </div>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
                      {type.short}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-select classes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Classes *</Label>
                <button type="button" onClick={toggleAll} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1">
                  {selectedClasses.length === classes.length ? <><CheckSquare className="w-3.5 h-3.5" />Deselect All</> : <><Square className="w-3.5 h-3.5" />Select All</>}
                </button>
              </div>
              {selectedClasses.length > 0 && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950 rounded-xl">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    ✓ {selectedClasses.length} class{selectedClasses.length > 1 ? "es" : ""} selected
                  </span>
                </div>
              )}
              {gradeXI.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Grade XI</p>
                  <div className="grid grid-cols-2 gap-2">
                    {gradeXI.map((cls) => {
                      const isSelected = selectedClasses.includes(cls.id);
                      return (
                        <button key={cls.id} type="button" onClick={() => toggleClass(cls.id)}
                          className={cn("flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-sm",
                            isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 hover:border-blue-300")}>
                          <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300")}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="font-medium truncate">{cls.class_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {gradeXII.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-2">Grade XII</p>
                  <div className="grid grid-cols-2 gap-2">
                    {gradeXII.map((cls) => {
                      const isSelected = selectedClasses.includes(cls.id);
                      return (
                        <button key={cls.id} type="button" onClick={() => toggleClass(cls.id)}
                          className={cn("flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-sm",
                            isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 hover:border-blue-300")}>
                          <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300")}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="font-medium truncate">{cls.class_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Assessment title *</Label>
              <Input placeholder="e.g. Asesmen Formatif - Hope and Plan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Assessment description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Time Limit (minutes)</Label>
              <Input type="number" placeholder="e.g. 30" min="1" value={form.time_limit} onChange={(e) => setForm({ ...form, time_limit: e.target.value })} className="rounded-xl" />
            </div>

            {/* Scheduled publish */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Publish Schedule (optional)</Label>
                {form.published_at && (
                  <button type="button" onClick={() => setForm({ ...form, published_at: "" })} className="text-xs text-red-500 hover:underline">
                    Clear (publish now)
                  </button>
                )}
              </div>
              <Input type="datetime-local" min={minDateTime} value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} className="rounded-xl" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {form.published_at
                  ? `⏰ Assessment will be visible to students on ${new Date(form.published_at).toLocaleString()}`
                  : "Leave empty to publish immediately"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || selectedClasses.length === 0}>
              {creating ? "Creating..." : `Create for ${selectedClasses.length} Class${selectedClasses.length !== 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

