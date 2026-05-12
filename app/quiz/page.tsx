import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { QuizClient } from "@/components/quiz/quiz-client";
import type { User } from "@/types";

export default async function QuizPage() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");

  return (
    <DashboardLayout user={profile as User}>
      <QuizClient user={profile as User} />
    </DashboardLayout>
  );
}
