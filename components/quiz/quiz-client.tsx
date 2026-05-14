"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Clock, Trash2, Search, CheckSquare, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { User, Quiz, Class } from "@/types";

interface QuizClientProps {
  user: User;
}

export function QuizClient({ user }: QuizClientProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", description: "", time_limit: "" });

  const fetchData = async () => {
    const supabase = createClient();
    let query = supabase
      .from("quizzes")
      .select("*, class:classes(class_name)")
      .order("created_at", { ascending: false });

    if (user.role === "student" && user.class_id) {
      query = query.eq("class_id", user.class_id);
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
    if (selectedClasses.length === 0) {
      toast.error("Please select at least one class");
      return;
    }
    if (!form.title) {
      toast.error("Quiz title is required");
      return;
    }

    setCreating(true);
    const supabase = createClient();

    const insertData = selectedClasses.map((classId) => ({
      class_id: classId,
      title: form.title,
      description: form.description || null,
      time_limit: form.time_limit ? parseInt(form.time_limit) : null,
    }));

    const { error } = await supabase.from("quizzes").insert(insertData);

    if (error) {
      toast.error("Failed to create quiz");
    } else {
      toast.success(
        selectedClasses.length === 1
          ? "Quiz created successfully!"
          : `Quiz created for ${selectedClasses.length} classes!`
      );
      setShowCreate(false);
      setSelectedClasses([]);
      setForm({ title: "", description: "", time_limit: "" });
      fetchData();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete quiz "${title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Quiz deleted"); fetchData(); }
  };

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase())
  );

  const gradeXI = classes.filter((c) => c.grade === "XI");
  const gradeXII = classes.filter((c) => c.grade === "XII");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz / AKM</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} quizzes available</p>
        </div>
        {user.role === "teacher" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Quiz
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search quiz..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No quizzes yet</p>
          {user.role === "teacher" && (
            <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              Create First Quiz
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow group border-0 shadow-sm">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  {user.role === "teacher" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{quiz.title}</h3>
                {quiz.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{quiz.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {(quiz.class as any)?.class_name && (
                    <Badge variant="secondary" className="text-xs">{(quiz.class as any).class_name}</Badge>
                  )}
                  {quiz.time_limit && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {quiz.time_limit} min
                    </span>
                  )}
                </div>
                <Link href={`/quiz/${quiz.id}`}>
                  <Button className="w-full rounded-xl" size="sm">
                    {user.role === "teacher" ? "Manage Quiz" : "Start Quiz"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Quiz Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) { setSelectedClasses([]); setForm({ title: "", description: "", time_limit: "" }); }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Multi-select classes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Classes *</Label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                >
                  {selectedClasses.length === classes.length ? (
                    <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                  ) : (
                    <><Square className="w-3.5 h-3.5" /> Select All</>
                  )}
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
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleClass(cls.id)}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-sm",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                          )}>
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
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
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => toggleClass(cls.id)}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-sm",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                          )}>
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
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
              <Label>Quiz Title *</Label>
              <Input
                placeholder="e.g. AKM Quiz - Hope and Plan"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Quiz description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Time Limit (minutes)</Label>
              <Input
                type="number"
                placeholder="e.g. 30"
                min="1"
                value={form.time_limit}
                onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
                className="rounded-xl"
              />
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
