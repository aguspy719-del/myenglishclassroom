import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuizTakeClient } from "@/components/quiz/quiz-take-client";
import { AlreadyAttempted } from "@/components/quiz/already-attempted";
import type { User } from "@/types";

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
  const quiz = quizRes.data;

  // Check if student already attempted — ALL types are 1 attempt only
  if (user.role === "student") {
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
        questions={questionsRes.data || []}
      />
    </DashboardLayout>
  );
}
