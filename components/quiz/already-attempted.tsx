"use client";

import Link from "next/link";
import { ArrowLeft, Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGradeColor, getGradeLabel, formatDateTime } from "@/lib/utils";

interface AlreadyAttemptedProps {
  quiz: any;
  attempt: any;
}

export function AlreadyAttempted({ quiz, attempt }: AlreadyAttemptedProps) {
  const quizType = quiz.quiz_type || "formatif";

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
        <Lock className="w-12 h-12 text-gray-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Already Submitted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{quiz.title}</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6 pb-6 space-y-4">
          <div className="flex justify-center">
            {quizType === "sumatif_tengah" && (
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                Sumatif Tengah Semester
              </Badge>
            )}
            {quizType === "sumatif_akhir" && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Sumatif Akhir Semester
              </Badge>
            )}
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            {attempt.score !== null && attempt.score !== undefined ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Your Score</p>
                <p className={`text-5xl font-bold ${getGradeColor(attempt.score || 0)}`}>
                  {attempt.score}
                </p>
                <Badge className="mt-2 text-base px-3 py-1">
                  {getGradeLabel(attempt.score || 0)}
                </Badge>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Submitted: {formatDateTime(attempt.completed_at)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</p>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                  <p className="text-base font-semibold text-yellow-600 dark:text-yellow-400">
                    Waiting for teacher to grade
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Submitted: {formatDateTime(attempt.completed_at)}
                </p>
              </>
            )}
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              🔒 This assessment can only be taken once.
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Contact your teacher if you have any issues.
            </p>
          </div>
        </CardContent>
      </Card>

      <Link href="/quiz">
        <Button variant="outline" className="gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          Back to Assessment List
        </Button>
      </Link>
    </div>
  );
}

