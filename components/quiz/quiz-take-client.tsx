"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Clock, CheckCircle, ChevronRight, ChevronLeft,
  Plus, Trash2, Loader2, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getGradeColor, getGradeLabel } from "@/lib/utils";
import type { User, Quiz, QuizQuestion } from "@/types";

interface QuizTakeClientProps {
  user: User;
  quiz: Quiz;
  questions: QuizQuestion[];
}

export function QuizTakeClient({ user, quiz, questions: initialQuestions }: QuizTakeClientProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState((quiz.time_limit || 30) * 60);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "a" as const
  });
  const [addingQ, setAddingQ] = useState(false);

  // Timer
  useEffect(() => {
    if (!started || finished) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          handleFinish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, finished]);

  const handleFinish = useCallback(() => {
    if (finished) return;
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_answer) correct++;
    });
    const finalScore = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    setScore(finalScore);
    setFinished(true);

    // Save attempt
    const supabase = createClient();
    supabase.from("quiz_attempts").insert([{
      quiz_id: quiz.id,
      student_id: user.id,
      score: finalScore,
      completed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error("Failed to save attempt:", error);
    });
  }, [answers, questions, quiz.id, user.id, finished]);

  const handleAddQuestion = async () => {
    if (!newQuestion.question || !newQuestion.option_a || !newQuestion.option_b ||
        !newQuestion.option_c || !newQuestion.option_d) {
      toast.error("Semua field pertanyaan harus diisi");
      return;
    }
    setAddingQ(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("quiz_questions").insert([{
      quiz_id: quiz.id,
      ...newQuestion,
      order_number: questions.length + 1,
    }]).select().single();

    if (error) {
      toast.error("Gagal menambah pertanyaan");
    } else {
      toast.success("Pertanyaan ditambahkan");
      setQuestions([...questions, data]);
      setNewQuestion({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "a" });
      setShowAddQuestion(false);
    }
    setAddingQ(false);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Hapus pertanyaan ini?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus");
    else {
      toast.success("Pertanyaan dihapus");
      setQuestions(questions.filter((q) => q.id !== id));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const optionLabels = { a: "A", b: "B", c: "C", d: "D" };

  // Teacher view
  if (user.role === "teacher") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/quiz">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {(quiz.class as any)?.class_name && <Badge variant="secondary">{(quiz.class as any).class_name}</Badge>}
              {quiz.time_limit && <Badge variant="info"><Clock className="w-3 h-3 mr-1" />{quiz.time_limit} menit</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-gray-600 dark:text-gray-400">{questions.length} pertanyaan</p>
          <Button onClick={() => setShowAddQuestion(!showAddQuestion)} className="gap-2" size="sm">
            <Plus className="w-4 h-4" />
            Tambah Soal
          </Button>
        </div>

        {showAddQuestion && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tambah Pertanyaan Baru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pertanyaan *</Label>
                <Textarea
                  placeholder="Tulis pertanyaan di sini..."
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["a", "b", "c", "d"] as const).map((opt) => (
                  <div key={opt} className="space-y-1">
                    <Label>Pilihan {opt.toUpperCase()} *</Label>
                    <Input
                      placeholder={`Opsi ${opt.toUpperCase()}`}
                      value={newQuestion[`option_${opt}` as keyof typeof newQuestion] as string}
                      onChange={(e) => setNewQuestion({ ...newQuestion, [`option_${opt}`]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Jawaban Benar *</Label>
                <Select
                  value={newQuestion.correct_answer}
                  onValueChange={(v) => setNewQuestion({ ...newQuestion, correct_answer: v as any })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["a", "b", "c", "d"] as const).map((opt) => (
                      <SelectItem key={opt} value={opt}>Pilihan {opt.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAddQuestion} disabled={addingQ} className="gap-2">
                  {addingQ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Tambah
                </Button>
                <Button variant="outline" onClick={() => setShowAddQuestion(false)}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>Belum ada pertanyaan. Tambahkan soal untuk kuis ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={q.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-3">
                        <span className="text-blue-600 dark:text-blue-400 mr-2">{idx + 1}.</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["a", "b", "c", "d"] as const).map((opt) => (
                          <div
                            key={opt}
                            className={`p-2 rounded-lg text-sm ${
                              q.correct_answer === opt
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span className="font-bold mr-1">{opt.toUpperCase()}.</span>
                            {q[`option_${opt}` as keyof QuizQuestion] as string}
                            {q.correct_answer === opt && " ✓"}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:bg-red-50 flex-shrink-0"
                      onClick={() => handleDeleteQuestion(q.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student: Finished
  if (finished) {
    const correct = questions.filter((q) => answers[q.id] === q.correct_answer).length;
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-8">
        <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto">
          <Trophy className="w-12 h-12 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kuis Selesai!</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{quiz.title}</p>
        </div>
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className={`text-6xl font-bold ${getGradeColor(score)}`}>{score}</p>
            <p className="text-gray-500 dark:text-gray-400 mt-1">dari 100</p>
            <Badge className="mt-3 text-lg px-4 py-1">{getGradeLabel(score)}</Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
              Benar: {correct} dari {questions.length} soal
            </p>
          </CardContent>
        </Card>
        <Link href="/quiz">
          <Button className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Kuis
          </Button>
        </Link>
      </div>
    );
  }

  // Student: Not started
  if (!started) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/quiz">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
        </div>
        <Card>
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{quiz.title}</h2>
              {quiz.description && <p className="text-gray-500 dark:text-gray-400 mt-1">{quiz.description}</p>}
            </div>
            <div className="flex justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{questions.length}</p>
                <p>Soal</p>
              </div>
              {quiz.time_limit && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.time_limit}</p>
                  <p>Menit</p>
                </div>
              )}
            </div>
            {questions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Kuis ini belum memiliki soal.</p>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={() => setStarted(true)}
              >
                Mulai Kuis
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Student: Taking quiz
  const currentQuestion = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Timer & Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Soal {currentQ + 1} dari {questions.length}</span>
        </div>
        <div className={`flex items-center gap-2 font-mono font-bold text-lg ${
          timeLeft < 60 ? "text-red-600" : "text-gray-900 dark:text-white"
        }`}>
          <Clock className="w-5 h-5" />
          {formatTime(timeLeft)}
        </div>
      </div>
      <Progress value={progress} className="h-2" />

      {/* Question */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-6">
            <span className="text-blue-600 dark:text-blue-400 mr-2">{currentQ + 1}.</span>
            {currentQuestion.question}
          </p>

          <div className="space-y-3">
            {(["a", "b", "c", "d"] as const).map((opt) => {
              const isSelected = answers[currentQuestion.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setAnswers({ ...answers, [currentQuestion.id]: opt })}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className={`font-bold mr-3 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-500"}`}>
                    {opt.toUpperCase()}.
                  </span>
                  {currentQuestion[`option_${opt}` as keyof QuizQuestion] as string}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Sebelumnya
        </Button>

        {currentQ === questions.length - 1 ? (
          <Button onClick={handleFinish} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Selesai
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
            className="gap-2"
          >
            Selanjutnya
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap gap-2 justify-center">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentQ(idx)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
              idx === currentQ
                ? "bg-blue-600 text-white"
                : answers[q.id]
                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
