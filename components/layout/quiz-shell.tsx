"use client";

import { usePathname } from "next/navigation";
import { DashboardLayout } from "./dashboard-layout";
import type { User } from "@/types";

interface QuizShellProps {
  user: User;
  children: React.ReactNode;
}

/**
 * Shell for the quiz-taking route.
 * Students on /quiz/[id] get a clean focus screen — no navbar, no sidebar,
 * no bottom nav. Teachers keep the normal dashboard layout.
 */
export function QuizShell({ user, children }: QuizShellProps) {
  const pathname = usePathname();
  const isStudentTakingQuiz = user.role === "student" && pathname !== "/quiz";

  if (isStudentTakingQuiz) {
    // Clean, focused page for the student taking the assessment
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="page-enter max-w-2xl mx-auto p-4 pb-10">{children}</div>
      </div>
    );
  }

  // Teachers and the /quiz list keep the normal layout
  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
