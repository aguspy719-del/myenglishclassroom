import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuizTakeClient } from "@/components/quiz/quiz-take-client";
import type { User } from "@/types";

export default async function QuizTakePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [profileRes, quizRes, questionsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase.from("quizzes").select("*, class:classes(class_name)").eq("id", params.id).single(),
    supabase.from("quiz_questions").select("*").eq("quiz_id", params.id).order("order_number"),
  ]);

  if (!profileRes.data) redirect("/login");
  if (!quizRes.data) notFound();

  return (
    <DashboardLayout user={profileRes.data as User}>
      <QuizTakeClient
        user={profileRes.data as User}
        quiz={quizRes.data}
        questions={questionsRes.data || []}
      />
    </DashboardLayout>
  );
}
