import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GradesRekapClient } from "@/components/grades/grades-rekap-client";
import type { User } from "@/types";

export default async function GradesRekapPage() {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher") redirect("/grades");

  return (
    <DashboardLayout user={profile as User}>
      <GradesRekapClient />
    </DashboardLayout>
  );
}
