"use client";

import { ReactNode } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types";

const OPT_KEYS = ["a", "b", "c", "d"] as const;

interface AnswerReviewProps {
  questions: QuizQuestion[];
  /** Student's MC answers: { questionId: "a"|"b"|"c"|"d" } */
  answers: Record<string, string>;
  /**
   * Optional slot rendered inside each essay question's answer box —
   * the parent supplies the essay text, score, and feedback UI.
   */
  essaySlot?: (questionId: string) => ReactNode;
}

/**
 * Post-grading answer review — shared by the student (their own attempt)
 * and the teacher (any student's attempt). Shows every question with the
 * chosen option and correct/incorrect marking; essays render whatever the
 * parent passes through `essaySlot`.
 */
export function AnswerReview({ questions, answers, essaySlot }: AnswerReviewProps) {
  if (!questions.length) {
    return (
      <p className="text-center text-sm text-gray-500 py-6">No questions to review.</p>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q, idx) => {
        const isEssay = (q as any).question_type === "essay";
        const chosen = answers?.[q.id];
        const isCorrect = !isEssay && chosen === q.correct_answer;

        return (
          <Card key={q.id} className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-emerald-600 font-bold text-sm flex-shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                    {q.question}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className={cn(
                      "text-[10px]",
                      isEssay
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    )}>
                      {isEssay ? "Essay" : "MC"}
                    </Badge>
                    {(q as any).max_score && (
                      <span className="text-[11px] text-gray-400">Max: {(q as any).max_score} pts</span>
                    )}
                  </div>
                </div>
              </div>

              {isEssay ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  {essaySlot ? (
                    essaySlot(q.id)
                  ) : (
                    <p className="text-xs text-gray-400">Essay answer not loaded</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OPT_KEYS.map((opt) => {
                    const isChosen = chosen === opt;
                    const isAnswer = q.correct_answer === opt;
                    return (
                      <div
                        key={opt}
                        className={cn(
                          "flex items-start gap-2 p-2.5 rounded-xl text-xs border-2",
                          isAnswer
                            ? "border-green-500 bg-green-50 dark:bg-green-950/50"
                            : isChosen
                              ? "border-red-400 bg-red-50 dark:bg-red-950/50"
                              : "border-gray-100 dark:border-gray-800",
                        )}
                      >
                        <span className="font-bold flex-shrink-0 mt-0.5">
                          {isAnswer ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          ) : isChosen ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <span className="text-gray-400">{opt.toUpperCase()}.</span>
                          )}
                        </span>
                        <span className={cn(
                          "flex-1 min-w-0 whitespace-pre-wrap",
                          isAnswer
                            ? "text-green-800 dark:text-green-200 font-semibold"
                            : isChosen
                              ? "text-red-700 dark:text-red-300 font-semibold"
                              : "text-gray-600 dark:text-gray-400",
                        )}>
                          <span className="font-bold mr-1">{opt.toUpperCase()}.</span>
                          {q[`option_${opt}` as keyof QuizQuestion] as string}
                        </span>
                      </div>
                    );
                  })}
                  {chosen && !isCorrect && (
                    <p className="text-[11px] text-red-500 sm:col-span-2">
                      Your answer: {chosen.toUpperCase()} — correct answer: {(q.correct_answer || "").toUpperCase()}
                    </p>
                  )}
                  {!chosen && (
                    <p className="text-[11px] text-gray-400 sm:col-span-2">Not answered</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
