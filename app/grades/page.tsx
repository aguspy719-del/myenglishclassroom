import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GradesClient } from "@/components/grades/grades-client";
import type { User } from "@/types";

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");

  return (
    <DashboardLayout user={profile as User}>
      <GradesClient user={profile as User} />
    </DashboardLayout>
  );
}
