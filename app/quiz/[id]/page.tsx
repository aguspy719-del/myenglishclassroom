import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuizTakeClient } from "@/components/quiz/quiz-take-client";
import { AlreadyAttempted } from "@/components/quiz/already-attempted";
import type { User, Quiz } from "@/types";

// Never cache this page — always check fresh attempt status
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuizTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [profileRes, quizRes, questionsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase.from("quizzes").select("*, class:classes(class_name)").eq("id", id).single(),
    supabase.from("quiz_questions").select("*").eq("quiz_id", id).order("order_number"),
  ]);

  if (!profileRes.data) redirect("/login");
  if (!quizRes.data) notFound();

  const user: User = profileRes.data;
  const quiz = quizRes.data as Quiz;
  const questions = questionsRes.data || [];

  // ── Server-side access gating for students ──
  if (user.role === "student") {
    const now = new Date();

    // Not for this class → students shouldn't even see it
    if (quiz.class_id && quiz.class_id !== user.class_id) redirect("/quiz");

    // Not sent yet (draft), or scheduled but time hasn't come, or already closed.
    // Scheduled quizzes open automatically once published_at passes (no cron needed).
    const notSent = quiz.is_published === false &&
      (!quiz.published_at || new Date(quiz.published_at) > now);
    const closed = quiz.available_until && new Date(quiz.available_until) <= now;

    if (notSent || closed) redirect("/quiz");

    // Check if student already attempted — ALL types are 1 attempt only
    const { data: existingAttempt } = await supabase
      .from("quiz_attempts")
      .select("id, score, completed_at")
      .eq("quiz_id", id)
      .eq("student_id", user.id)
      .not("completed_at", "is", null)
      .maybeSingle();
    if (existingAttempt) {
      return (
        <DashboardLayout user={user}>
          <AlreadyAttempted quiz={quiz} attempt={existingAttempt} />
        </DashboardLayout>
      );
    }
  }

  return (
    <DashboardLayout user={user}>
      <QuizTakeClient
        user={user}
        quiz={quiz}
        questions={questions}
      />
    </DashboardLayout>
  );
}
