"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clock, CheckCircle, ChevronRight, ChevronLeft, ChevronDown,
  Plus, Trash2, Loader2, Trophy, Users, BarChart2, FileText, PenLine, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn, getGradeColor, getGradeLabel, formatDateTime } from "@/lib/utils";
import { MarqueeText } from "@/components/ui/marquee-text";
import { QuizAntiCheat } from "./quiz-anti-cheat";
import { QuizSendPanel } from "./quiz-send-panel";
import type { User, Quiz, QuizQuestion } from "@/types";

interface QuizTakeClientProps {
  user: User;
  quiz: Quiz;
  questions: QuizQuestion[];
}

const LETTERS = ["A", "B", "C", "D"] as const;
const OPT_KEYS = ["a", "b", "c", "d"] as const;

// English labels for logged anti-cheat violation types
const VIOLATION_LABELS: Record<string, string> = {
  tab_switch: "Left the page (tab, app, or notification)",
  focus_loss: "Page lost focus (opened another app or notification)",
  fullscreen_exit: "Exited fullscreen mode",
};

const emptyMC = () => ({
  id: crypto.randomUUID(),
  question_type: "multiple_choice" as const,
  question: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_answer: "a" as const, max_score: 10,
});

const emptyEssay = () => ({
  id: crypto.randomUUID(),
  question_type: "essay" as const,
  question: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_answer: "a" as const, max_score: 20,
});

// Deterministic shuffle — same order for the whole attempt (survives refresh)
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return Math.abs(h % 10000) / 10000;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizTakeClient({ user, quiz, questions: initialQuestions }: QuizTakeClientProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [existingScore, setExistingScore] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number | null; correctCount: number; mcCount: number; essaySaved: number } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [timeLeft, setTimeLeft] = useState((quiz.time_limit || 30) * 60);

  // Shuffle maps, created once when the student starts
  const [shuffledQs, setShuffledQs] = useState<QuizQuestion[] | null>(null);
  const [optionMaps, setOptionMaps] = useState<Record<string, string[]>>({});

  // Check if already attempted on mount (client-side guard)
  useEffect(() => {
    if (user.role !== "student") return;
    const supabase = createClient();
    supabase.from("quiz_attempts")
      .select("id, score, completed_at")
      .eq("quiz_id", quiz.id)
      .eq("student_id", user.id)
      .not("completed_at", "is", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAlreadyAttempted(true);
          setExistingScore(data.score ?? null);
        }
      });
  }, [quiz.id, user.id, user.role]);

  const startQuiz = () => {
    const qs = seededShuffle(initialQuestions, quiz.id + user.id);
    const maps: Record<string, string[]> = {};
    qs.forEach((q) => {
      if ((q as any).question_type !== "essay") {
        maps[q.id] = seededShuffle([...OPT_KEYS], q.id + user.id);
      }
    });
    setShuffledQs(qs);
    setOptionMaps(maps);
    setStarted(true);
  };

  // Submit through the server API — correct answers never live in the browser
  const handleSubmit = useCallback(async () => {
    if (finished || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, mc: answers, essays: essayAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error || "Failed to submit. Check your connection and try again.");
        toast.error(data?.error || "Failed to submit");
        setSubmitting(false);
        return;
      }
      setResult(data);
      setFinished(true);
    } catch {
      setSubmitError("Network error — your answers were NOT saved. Press Finish again.");
      toast.error("Network error — try again");
    }
    setSubmitting(false);
  }, [answers, essayAnswers, finished, submitting, quiz.id]);

  const handleFinishRef = useRef(handleSubmit);
  useEffect(() => { handleFinishRef.current = handleSubmit; }, [handleSubmit]);

  useEffect(() => {
    if (!started || finished) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); handleFinishRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, finished]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (user.role === "teacher") {
    return <TeacherQuizView quiz={quiz} questions={questions} setQuestions={setQuestions} />;
  }

  // Client-side guard: already attempted
  if (alreadyAttempted) {
    return (
      <QuizAntiCheat isActive={false} quizId={quiz.id} onForceSubmit={() => {}}>
        <div className="max-w-lg mx-auto text-center space-y-6 py-8">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12 text-gray-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Already Submitted</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{quiz.title}</p>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6 pb-6 space-y-3">
              {existingScore !== null && existingScore !== undefined ? (
                <>
                  <p className={`text-6xl font-bold ${getGradeColor(existingScore)}`}>{existingScore}</p>
                  <p className="text-sm text-gray-500">Final Score</p>
                  <Badge className="text-lg px-4 py-1">Grade: {getGradeLabel(existingScore)}</Badge>
                </>
              ) : (
                <div className="py-4">
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                    <p className="text-base font-semibold text-yellow-600 dark:text-yellow-400">
                      Waiting for teacher to grade
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 text-center">Your essay answers have been submitted</p>
                </div>
              )}
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                  🔒 This assessment can only be taken once.
                </p>
              </div>
            </CardContent>
          </Card>
          <Link href="/quiz">
            <Button className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" />Back to Assessment List</Button>
          </Link>
        </div>
      </QuizAntiCheat>
    );
  }

  // Server said the window is closed / not open yet
  if (submitError && !finished) {
    return (
      <QuizAntiCheat isActive={false} quizId={quiz.id} onForceSubmit={() => {}}>
        <div className="max-w-lg mx-auto text-center space-y-6 py-8">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-12 h-12 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assessment Unavailable</h2>
          <p className="text-gray-500 dark:text-gray-400">{submitError}</p>
          <Link href="/quiz">
            <Button className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" />Back to Assessment List</Button>
          </Link>
        </div>
      </QuizAntiCheat>
    );
  }

  const quizType = (quiz as any).quiz_type || "formatif";

  if (finished && result) {
    return (
      <QuizAntiCheat isActive={false} quizId={quiz.id} onForceSubmit={() => {}}>
        <div className="max-w-lg mx-auto text-center space-y-6 py-8">
          <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Assessment Finished!</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{quiz.title}</p>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6 pb-6 space-y-3">
              {result.mcCount > 0 ? (
                <>
                  <p className={`text-6xl font-bold ${getGradeColor(result.score || 0)}`}>{result.score}</p>
                  <p className="text-sm text-gray-500">Multiple Choice Score</p>
                  <Badge className="text-lg px-4 py-1">Grade: {getGradeLabel(result.score || 0)}</Badge>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Correct: {result.correctCount} of {result.mcCount}</p>
                  {result.essaySaved > 0 && (
                    <p className="text-xs text-gray-500">Final score updates after essays are graded</p>
                  )}
                </>
              ) : (
                <div className="py-2">
                  <div className="flex items-center gap-2 justify-center mb-1">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                    <p className="text-base font-semibold text-yellow-600 dark:text-yellow-400">
                      Waiting for teacher to grade essays
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">Your score will appear in the Grades menu once graded</p>
                </div>
              )}
              {result.essaySaved > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    ✍️ {result.essaySaved} essay answer{result.essaySaved > 1 ? "s" : ""} submitted
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Essay will be graded by your teacher</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Link href="/quiz">
            <Button className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" />Back to Assessment List</Button>
          </Link>
        </div>
      </QuizAntiCheat>
    );
  }

  if (!started) {
    const mcCount = questions.filter((q) => (q as any).question_type !== "essay").length;
    const essayCount = questions.filter((q) => (q as any).question_type === "essay").length;
    return (
      <QuizAntiCheat isActive={false} quizId={quiz.id} onForceSubmit={() => {}}>
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/quiz"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{quiz.title}</h2>
                {quiz.description && <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{quiz.description}</p>}
              </div>
              <div className="flex justify-center">
                {quizType === "formatif" && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Asesmen Formatif · 1 attempt</Badge>}
                {quizType === "sumatif_tengah" && <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Sumatif Tengah Semester · 1 attempt only</Badge>}
                {quizType === "sumatif_akhir" && <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">Sumatif Akhir Semester · 1 attempt only</Badge>}
              </div>
              <div className="flex justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                {mcCount > 0 && <div className="text-center"><p className="text-2xl font-bold text-gray-900 dark:text-white">{mcCount}</p><p>Multiple Choice</p></div>}
                {essayCount > 0 && <div className="text-center"><p className="text-2xl font-bold text-gray-900 dark:text-white">{essayCount}</p><p>Essay</p></div>}
                {quiz.time_limit && <div className="text-center"><p className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.time_limit}</p><p>Minutes</p></div>}
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl text-sm text-red-700 dark:text-red-300 font-medium">
                ⚠️ 1 attempt only. Questions are shuffled per student. Leaving the page triggers a loud alarm — 3 warnings = auto-submit.
              </div>
              {questions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No questions yet.</p>
              ) : (
                <Button size="lg" className="w-full rounded-xl" onClick={startQuiz} disabled={submitting}>
                  Start Assessment
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </QuizAntiCheat>
    );
  }

  const activeQuestions = shuffledQs || questions;
  const currentQuestion = activeQuestions[currentQ];
  if (!currentQuestion) return null;
  const isEssay = (currentQuestion as any).question_type === "essay";
  const progress = ((currentQ + 1) / activeQuestions.length) * 100;

  return (
    <QuizAntiCheat isActive={true} quizId={quiz.id} onForceSubmit={handleSubmit} maxWarnings={3}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Question {currentQ + 1} of {activeQuestions.length}</span>
          <div className={cn("flex items-center gap-2 font-mono font-bold text-lg", timeLeft < 60 ? "text-red-600" : "text-gray-900 dark:text-white")}>
            <Clock className="w-5 h-5" />{formatTime(timeLeft)}
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-2 mb-4">
              {isEssay
                ? <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"><PenLine className="w-3 h-3 mr-1" />Essay</Badge>
                : <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><FileText className="w-3 h-3 mr-1" />Multiple Choice</Badge>
              }
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-6 whitespace-pre-wrap leading-relaxed">
              <span className="text-emerald-600 dark:text-emerald-400 mr-2 font-bold">{currentQ + 1}.</span>
              {currentQuestion.question}
            </p>
            {isEssay ? (
              <Textarea
                placeholder="Write your answer here..."
                value={essayAnswers[currentQuestion.id] || ""}
                onChange={(e) => setEssayAnswers({ ...essayAnswers, [currentQuestion.id]: e.target.value })}
                rows={6} className="rounded-xl"
              />
            ) : (
              <div className="space-y-3">
                {(optionMaps[currentQuestion.id] || [...OPT_KEYS]).map((actualOpt, idx) => {
                  const isSelected = answers[currentQuestion.id] === actualOpt;
                  return (
                    <button key={actualOpt} onClick={() => setAnswers({ ...answers, [currentQuestion.id]: actualOpt })}
                      className={cn("w-full text-left p-4 rounded-xl border-2 transition-all",
                        isSelected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-gray-200 dark:border-gray-700 hover:border-emerald-300")}>
                      <span className={cn("font-bold mr-3 flex-shrink-0", isSelected ? "text-emerald-600" : "text-gray-500")}>{LETTERS[idx]}.</span>
                      <span className="whitespace-pre-wrap">{currentQuestion[`option_${actualOpt}` as keyof QuizQuestion] as string}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0} className="gap-2 rounded-xl">
            <ChevronLeft className="w-4 h-4" />Previous
          </Button>
          {currentQ === activeQuestions.length - 1
            ? <Button onClick={handleSubmit} disabled={submitting} className="gap-2 rounded-xl">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {submitting ? "Submitting..." : "Finish"}
              </Button>
            : <Button onClick={() => setCurrentQ(currentQ + 1)} className="gap-2 rounded-xl">Next<ChevronRight className="w-4 h-4" /></Button>
          }
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {activeQuestions.map((q, idx) => {
            const isEssayQ = (q as any).question_type === "essay";
            const answered = isEssayQ ? !!essayAnswers[q.id] : !!answers[q.id];
            return (
              <button key={q.id} onClick={() => setCurrentQ(idx)}
                className={cn("w-8 h-8 rounded-full text-xs font-bold",
                  idx === currentQ ? "bg-emerald-600 text-white" :
                  answered ? "bg-green-100 dark:bg-green-900 text-green-700" :
                  "bg-gray-100 dark:bg-gray-800 text-gray-600")}>
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </QuizAntiCheat>
  );
}


// ── Teacher View ──────────────────────────────────────────
interface TeacherQuizViewProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  setQuestions: (q: QuizQuestion[]) => void;
}

function TeacherQuizView({ quiz, questions, setQuestions }: TeacherQuizViewProps) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [essayAnswers, setEssayAnswers] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [expandedViolations, setExpandedViolations] = useState<Record<string, boolean>>({});
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [sameTypeQuizzes, setSameTypeQuizzes] = useState<any[]>([]);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const refreshData = useCallback(async () => {
    const supabase = createClient();
    const [a, e, v] = await Promise.all([
      supabase.from("quiz_attempts").select("*, student:users(name,email)").eq("quiz_id", quiz.id).not("completed_at", "is", null).order("completed_at", { ascending: false }),
      supabase.from("essay_answers").select("*, student:users(name), question:quiz_questions(question)").eq("quiz_id", quiz.id).order("submitted_at", { ascending: false }),
      supabase.from("quiz_violations").select("id, student_id, type, detail, created_at").eq("quiz_id", quiz.id).order("created_at", { ascending: false }),
    ]);
    setAttempts(a.data || []);
    setEssayAnswers(e.data || []);
    setViolations(v.data || []);
    setLoadingAttempts(false);
  }, [quiz.id]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const s = await supabase
        .from("quizzes")
        .select("id, title, class:classes(class_name)")
        .eq("quiz_type", (quiz as any).quiz_type || "formatif")
        .neq("id", quiz.id)
        .order("created_at", { ascending: false });
      setSameTypeQuizzes(s.data || []);
      refreshData();
    };
    load();
  }, [quiz, refreshData]);

  const addDraft = (type: "multiple_choice" | "essay") => {
    setDrafts((p) => [...p, type === "essay" ? emptyEssay() : emptyMC()]);
    // Scroll the new card into view so the flow feels obvious
    setTimeout(() => {
      document.getElementById("draft-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const updateDraft = (id: string, field: string, value: string) =>
    setDrafts((p) => p.map((d) => d.id === id ? { ...d, [field]: value } : d));

  const removeDraft = (id: string) => setDrafts((p) => p.filter((d) => d.id !== id));

  const saveDrafts = async () => {
    // Clear, specific validation so the teacher knows exactly what is missing
    const problems: string[] = [];
    drafts.forEach((d, i) => {
      const n = i + 1;
      if (!d.question.trim()) problems.push(`Question ${n}: the question text is empty`);
      if (d.question_type === "multiple_choice") {
        for (const k of OPT_KEYS) {
          if (!d[`option_${k}`]?.trim()) problems.push(`Question ${n}: option ${k.toUpperCase()} is empty`);
        }
      }
    });
    if (problems.length > 0) {
      toast.error(problems.slice(0, 3).join(" · "));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("quiz_questions").insert(
      drafts.map((d, idx) => ({
        quiz_id: quiz.id, question: d.question.trim(), question_type: d.question_type,
        option_a: d.option_a || "", option_b: d.option_b || "",
        option_c: d.option_c || "", option_d: d.option_d || "",
        correct_answer: d.correct_answer || "a", max_score: d.max_score || 10,
        order_number: questions.length + idx + 1,
      }))
    ).select();
    if (error) { toast.error("Failed to save"); }
    else { toast.success(`${data.length} question${data.length > 1 ? "s" : ""} saved!`); setQuestions([...questions, ...(data as QuizQuestion[])]); setDrafts([]); }
    setSaving(false);
  };

  const handleCopyQuestions = async () => {
    if (copyTargets.length === 0 || questions.length === 0) { toast.error("Select target quizzes"); return; }
    setCopying(true);
    const supabase = createClient();
    let ok = 0;
    for (const tid of copyTargets) {
      const { error } = await supabase.from("quiz_questions").insert(
        questions.map((q, idx) => ({
          quiz_id: tid, question: q.question, question_type: (q as any).question_type || "multiple_choice",
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
          correct_answer: q.correct_answer, max_score: (q as any).max_score || 10, order_number: idx + 1,
        }))
      );
      if (!error) ok++;
    }
    if (ok > 0) { toast.success(`Copied to ${ok} quiz${ok > 1 ? "zes" : ""}!`); setShowCopy(false); setCopyTargets([]); }
    else toast.error("Failed to copy");
    setCopying(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) toast.error("Failed"); else { toast.success("Deleted"); setQuestions(questions.filter((q) => q.id !== id)); }
  };

  const gradeEssay = async (answerId: string, essayScore: number, feedback: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("essay_answers").update({ score: essayScore, feedback }).eq("id", answerId);
    if (error) { toast.error("Failed"); return; }

    toast.success("Graded!");
    setEssayAnswers((p) => p.map((a) => a.id === answerId ? { ...a, score: essayScore, feedback } : a));

    // Recalculate total score for this student and update quiz_attempts
    const gradedAnswer = essayAnswers.find((a) => a.id === answerId);
    if (!gradedAnswer) return;

    const studentId = gradedAnswer.student_id || gradedAnswer.student?.id;
    if (!studentId) return;

    // Get all essay answers for this student in this quiz
    const { data: allEssayAnswers } = await supabase
      .from("essay_answers")
      .select("score, question:quiz_questions(max_score)")
      .eq("quiz_id", quiz.id)
      .eq("student_id", studentId)
      .not("score", "is", null);

    // Get MC score from existing attempt
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("id, score")
      .eq("quiz_id", quiz.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!attempt) return;

    const mcCount = questions.filter((q) => (q as any).question_type !== "essay").length;
    const essayCount = questions.filter((q) => (q as any).question_type === "essay").length;
    const totalQuestions = mcCount + essayCount;

    if (totalQuestions === 0) return;

    // MC score is stored as percentage of MC questions
    const mcScore = mcCount > 0 ? (attempt.score || 0) * mcCount / 100 : 0;

    // Essay score: sum of (score/max_score) per essay
    const essayTotalScore = (allEssayAnswers || []).reduce((sum, ea) => {
      const maxScore = (ea.question as any)?.max_score || 10;
      return sum + ((ea.score || 0) / maxScore) * 100;
    }, 0);
    const essayAvg = essayCount > 0 ? essayTotalScore / essayCount : 0;

    const combinedScore = Math.round(
      (mcCount * (attempt.score || 0) + essayCount * essayAvg) / totalQuestions
    );

    await supabase.from("quiz_attempts")
      .update({ score: combinedScore })
      .eq("id", attempt.id);

    refreshData();
  };

  const deleteEssayAnswer = async (answerId: string, studentName: string) => {
    if (!confirm(`Delete essay answer from ${studentName}? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("essay_answers").delete().eq("id", answerId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Answer deleted");
    setEssayAnswers((p) => p.filter((a) => a.id !== answerId));
  };

  const avgScore = attempts.length > 0 ? Math.round(attempts.reduce((a, b) => a + (b.score || 0), 0) / attempts.length) : 0;
  const mcCount = questions.filter((q) => (q as any).question_type !== "essay").length;
  const essayCount = questions.filter((q) => (q as any).question_type === "essay").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/quiz"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(quiz.class as any)?.class_name && <Badge variant="secondary">{(quiz.class as any).class_name}</Badge>}
            {quiz.time_limit && <Badge variant="info"><Clock className="w-3 h-3 mr-1" />{quiz.time_limit} min</Badge>}
            <Badge variant="outline">{mcCount} MC · {essayCount} Essay</Badge>
          </div>
        </div>
      </div>

      {/* Send & access control */}
      <QuizSendPanel
        quiz={quiz}
        questionCount={questions.length}
        attemptCount={attempts.length}
      />

      <Tabs defaultValue="questions">
        <TabsList className="w-full sm:w-auto flex h-auto">
          <TabsTrigger value="questions" className="gap-1 flex-shrink-0"><BarChart2 className="w-4 h-4" />Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="results" className="gap-1 flex-shrink-0"><Users className="w-4 h-4" />Results ({attempts.length})</TabsTrigger>
          {essayCount > 0 && <TabsTrigger value="essays" className="gap-1 flex-shrink-0"><PenLine className="w-4 h-4" />Essays ({essayAnswers.length})</TabsTrigger>}
        </TabsList>

        {/* Questions Tab */}
        <TabsContent value="questions" className="mt-4 space-y-4">
          {/* Step-by-step builder — clear flow for making MC questions */}
          <Card className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">How to add questions:</p>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                <li>Tap <b>Add Multiple Choice</b> or <b>Add Essay</b> below</li>
                <li>Write the question, fill options A–D, then <b>tap the circle</b> next to the correct answer</li>
                <li>Tap <b>Save Questions</b> — then send via the panel above</li>
              </ol>
              <div className="flex gap-2 flex-wrap mt-3">
                <Button onClick={() => addDraft("multiple_choice")} size="sm" className="gap-1 rounded-xl">
                  <Plus className="w-4 h-4" /><FileText className="w-4 h-4" />Add Multiple Choice
                </Button>
                <Button onClick={() => addDraft("essay")} variant="outline" size="sm" className="gap-1 rounded-xl">
                  <Plus className="w-4 h-4" /><PenLine className="w-4 h-4" />Add Essay
                </Button>
                {questions.length > 0 && sameTypeQuizzes.length > 0 && (
                  <Button onClick={() => setShowCopy(!showCopy)} variant="outline" size="sm" className="gap-1 rounded-xl border-green-400 text-green-700 hover:bg-green-50 dark:text-green-400">
                    <Users className="w-4 h-4" />Copy to Other Classes
                  </Button>
                )}
                {drafts.length > 0 && (
                  <Button onClick={saveDrafts} disabled={saving} size="sm" className="gap-1 rounded-xl ml-auto">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Save {drafts.length} Question{drafts.length > 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Copy panel */}
          {showCopy && (
            <Card className="border-2 border-green-300 dark:border-green-700">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Copy {questions.length} questions to:</p>
                  <Button variant="ghost" size="sm" onClick={() => { setShowCopy(false); setCopyTargets([]); }} className="text-xs">Cancel</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sameTypeQuizzes.map((q) => {
                    const sel = copyTargets.includes(q.id);
                    return (
                      <button key={q.id} type="button"
                        onClick={() => setCopyTargets((p) => p.includes(q.id) ? p.filter((id) => id !== q.id) : [...p, q.id])}
                        className={cn("flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-sm transition-all",
                          sel ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700" : "border-gray-200 dark:border-gray-700 hover:border-green-300")}>
                        <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", sel ? "border-green-500 bg-green-500" : "border-gray-300")}>
                          {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div className="min-w-0">
                          <MarqueeText text={q.title} duration={6} className="font-medium text-xs" />
                          <MarqueeText text={q.class?.class_name || ""} duration={7} className="text-xs text-gray-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handleCopyQuestions} disabled={copying || copyTargets.length === 0} size="sm" className="gap-1 rounded-xl bg-green-600 hover:bg-green-700 text-white w-full">
                  {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Copy to {copyTargets.length} Quiz{copyTargets.length !== 1 ? "zes" : ""}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Draft questions — numbered, guided flow */}
          <div id="draft-editor" className="space-y-4">
            {drafts.map((draft, idx) => (
              <Card key={draft.id} className="border-2 border-emerald-400 dark:border-emerald-600 shadow-md">
                <CardContent className="pt-4 pb-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={draft.question_type === "essay" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"}>
                      {draft.question_type === "essay" ? "✍️ Essay" : "📝 Multiple Choice"} — New #{idx + 1}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeDraft(draft.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>

                  {/* STEP 1 — question text */}
                  <div className="space-y-1.5">
                    <Label className="text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                      Write the question *
                    </Label>
                    <Textarea placeholder="e.g. Choose the correct sentence..." value={draft.question} onChange={(e) => updateDraft(draft.id, "question", e.target.value)} rows={2} className="rounded-xl text-sm" />
                  </div>

                  {/* STEP 2 — options (MC only) */}
                  {draft.question_type === "multiple_choice" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                          Fill options A–D *
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {OPT_KEYS.map((opt) => (
                            <div key={opt} className="space-y-1">
                              <Label className="text-xs text-gray-500">Option {opt.toUpperCase()}</Label>
                              <Input placeholder={`Option ${opt.toUpperCase()}`} value={draft[`option_${opt}`]} onChange={(e) => updateDraft(draft.id, `option_${opt}`, e.target.value)} className="rounded-xl text-sm h-9" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* STEP 3 — tap the correct answer */}
                      <div className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                          Tap the circle next to the <span className="text-green-600 font-bold">correct answer</span>
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {OPT_KEYS.map((opt) => {
                            const isCorrect = draft.correct_answer === opt;
                            const filled = !!draft[`option_${opt}`]?.trim();
                            return (
                              <button key={opt} type="button"
                                onClick={() => updateDraft(draft.id, "correct_answer", opt)}
                                disabled={!filled}
                                className={cn("flex items-center gap-2 p-2.5 rounded-xl border-2 text-left text-sm transition-all disabled:opacity-40",
                                  isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-gray-200 dark:border-gray-700 hover:border-green-300")}>
                                <span className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                  isCorrect ? "border-green-500 bg-green-500" : "border-gray-300")}>
                                  {isCorrect && <CheckCircle className="w-3 h-3 text-white" />}
                                </span>
                                <span className="font-bold text-xs text-gray-500">{opt.toUpperCase()}.</span>
                                <span className="truncate">{draft[`option_${opt}`] || `Option ${opt.toUpperCase()}`}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Essay max score */}
                  {draft.question_type === "essay" && (
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap">Max Score:</Label>
                      <Input type="number" min="1" max="100" value={draft.max_score} onChange={(e) => updateDraft(draft.id, "max_score", e.target.value)} className="w-24 h-8 rounded-xl text-sm" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Saved questions */}
          {questions.length === 0 && drafts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No questions yet. Add questions above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const isEssayQ = (q as any).question_type === "essay";
                return (
                  <Card key={q.id} className="border-0 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-emerald-600 font-bold text-sm">{idx + 1}.</span>
                            <Badge className={isEssayQ ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs"}>
                              {isEssayQ ? "Essay" : "MC"}
                            </Badge>
                            {isEssayQ && (q as any).max_score && <span className="text-xs text-gray-500">Max: {(q as any).max_score} pts</span>}
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm mb-3 whitespace-pre-wrap leading-relaxed">{q.question}</p>
                          {!isEssayQ && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {OPT_KEYS.map((opt) => (
                                <div key={opt} className={cn("p-2 rounded-xl text-xs", q.correct_answer === opt ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-semibold" : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400")}>
                                  <span className="font-bold mr-1">{opt.toUpperCase()}.</span>
                                  <span className="whitespace-pre-wrap">{q[`option_${opt}` as keyof QuizQuestion] as string}</span>
                                  {q.correct_answer === opt && " ✓"}
                                </div>
                              ))}
                            </div>
                          )}
                          {isEssayQ && <p className="text-xs text-gray-500 italic">Students write their answer in a text box</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 h-8 w-8" onClick={() => deleteQuestion(q.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl text-xs"
              onClick={async () => { await refreshData(); toast.success("Refreshed!"); }}
            >
              🔄 Refresh Results
            </Button>
          </div>
          {attempts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Submissions", value: attempts.length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
                { label: "Average", value: avgScore, color: getGradeColor(avgScore), bg: "bg-gray-50 dark:bg-gray-800" },
                { label: "Highest", value: Math.max(...attempts.map((a) => a.score || 0)), color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
                { label: "Lowest", value: Math.min(...attempts.map((a) => a.score || 0)), color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
              ].map((s) => (
                <Card key={s.label} className="border-0 shadow-sm">
                  <CardContent className={`pt-4 pb-4 text-center rounded-xl ${s.bg}`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {loadingAttempts ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No students have taken this quiz yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts.map((a, idx) => {
                const studentViolations = violations.filter((v) => v.student_id === (a.student_id || a.student?.id));
                const isExpanded = !!expandedViolations[a.id];
                return (
                <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center text-xs font-bold text-emerald-600 flex-shrink-0">{idx + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <MarqueeText text={a.student?.name || "Student"} className="font-medium text-sm text-gray-900 dark:text-white flex-1 min-w-0" />
                          {(studentViolations.length > 0 || (a.violations || 0) > 0) && (
                            <button
                              type="button"
                              onClick={() => setExpandedViolations((p) => ({ ...p, [a.id]: !p[a.id] }))}
                              className="flex-shrink-0"
                              title="Show violation details"
                            >
                              <Badge className={cn(
                                "text-[10px] cursor-pointer hover:opacity-80 transition-opacity gap-0.5",
                                studentViolations.length > 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              )}>
                                ⚠ {studentViolations.length || a.violations} violation{(studentViolations.length || a.violations) > 1 ? "s" : ""}
                                <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
                              </Badge>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{a.completed_at ? formatDateTime(a.completed_at) : "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xl font-bold ${getGradeColor(a.score || 0)}`}>{a.score ?? "—"}</span>
                      {a.score !== null && <Badge variant="outline" className="text-xs">{getGradeLabel(a.score || 0)}</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 gap-1 rounded-xl"
                        onClick={async () => {
                          if (!confirm(`Reset attempt for ${a.student?.name}? They will be able to retake the assessment.`)) return;
                          const supabase = createClient();
                          const { error } = await supabase.from("quiz_attempts").delete().eq("id", a.id);
                          if (error) { toast.error("Failed to reset"); return; }
                          await supabase.from("essay_answers").delete()
                            .eq("quiz_id", quiz.id).eq("student_id", a.student_id || a.student?.id);
                          toast.success(`Attempt reset for ${a.student?.name}.`);
                          refreshData();
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                  {/* Expandable violation details per student */}
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      {studentViolations.length === 0 ? (
                        <p className="text-xs text-gray-400 px-1 py-2">
                          Detailed log is unavailable for this attempt (logged before the violation log existed).
                          Total recorded: {a.violations || 0}.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {studentViolations.map((v) => (
                            <div key={v.id} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/50 rounded-lg text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-red-700 dark:text-red-300">
                                  {VIOLATION_LABELS[v.type] || v.type}
                                </p>
                                <p className="text-red-500/80 dark:text-red-400/70 mt-0.5">
                                  {v.created_at ? formatDateTime(v.created_at) : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Essays Tab */}
        {essayCount > 0 && (
          <TabsContent value="essays" className="mt-4 space-y-4">
            {essayAnswers.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <PenLine className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No essay answers yet.</p>
              </div>
            ) : (
              essayAnswers.map((ea) => <EssayGradeCard key={ea.id} essayAnswer={ea} onGrade={gradeEssay} onDelete={deleteEssayAnswer} />)
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function EssayGradeCard({ essayAnswer, onGrade, onDelete }: {
  essayAnswer: any;
  onGrade: (id: string, score: number, feedback: string) => void;
  onDelete?: (id: string, studentName: string) => void;
}) {
  const [score, setScore] = useState(essayAnswer.score?.toString() || "");
  const [feedback, setFeedback] = useState(essayAnswer.feedback || "");
  const [editing, setEditing] = useState(!essayAnswer.score);
  const [showQuestion, setShowQuestion] = useState(false);
  const questionText = essayAnswer.question?.question || "";
  const isLongQuestion = questionText.length > 120;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <MarqueeText text={essayAnswer.student?.name || "Student"} className="font-semibold text-sm text-gray-900 dark:text-white" />
            <div className="mt-1">
              <p className={`text-xs text-gray-500 dark:text-gray-400 ${!showQuestion && isLongQuestion ? "line-clamp-2" : "whitespace-pre-wrap"}`}>
                {questionText}
              </p>
              {isLongQuestion && (
                <button onClick={() => setShowQuestion(!showQuestion)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5">
                  {showQuestion ? "Show less ↑" : "Show full question ↓"}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {essayAnswer.score != null && !editing && (
              <>
                <span className={`text-xl font-bold ${getGradeColor(essayAnswer.score)}`}>{essayAnswer.score}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-xs rounded-xl">Edit</Button>
              </>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => onDelete(essayAnswer.id, essayAnswer.student?.name || "Student")}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Student Answer:</p>
          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed break-words">
            {essayAnswer.answer || "(no answer)"}
          </p>
        </div>

        {editing && (
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Score (0-100)</Label>
                <Input type="number" min="0" max="100" placeholder="85" value={score}
                  onChange={(e) => setScore(e.target.value)} className="rounded-xl h-9" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Feedback</Label>
                <Input placeholder="Good answer!" value={feedback}
                  onChange={(e) => setFeedback(e.target.value)} className="rounded-xl h-9" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1 rounded-xl" onClick={() => {
                const s = parseInt(score);
                if (isNaN(s) || s < 0 || s > 100) { toast.error("Score must be 0-100"); return; }
                onGrade(essayAnswer.id, s, feedback);
                setEditing(false);
              }}><CheckCircle className="w-3 h-3" />Save Grade</Button>
              {essayAnswer.score != null && (
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
