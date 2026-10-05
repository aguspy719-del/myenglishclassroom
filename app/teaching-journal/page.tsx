import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TeachingJournalClient } from "@/components/teaching-journal/teaching-journal-client";
import type { User } from "@/types";

export default async function TeachingJournalPage() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile || profile.role !== "teacher") redirect("/dashboard");

  return (
    <DashboardLayout user={profile as User}>
      <TeachingJournalClient user={profile as User} />
    </DashboardLayout>
  );
}
