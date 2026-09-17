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
    // Clean, focused page for the student taking the assessment.
    // Top padding = safe-area (notch/status bar in PWA standalone) + fixed gap,
    // so content is never cut off at the top of the screen.
    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-950"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      >
        <div className="page-enter max-w-2xl mx-auto px-4 pb-10">{children}</div>
      </div>
    );
  }

  // Teachers and the /quiz list keep the normal layout
  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
