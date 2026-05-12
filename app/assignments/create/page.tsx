import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CreateAssignmentClient } from "@/components/assignments/create-assignment-client";
import type { User } from "@/types";

export default async function CreateAssignmentPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile || profile.role !== "teacher") redirect("/dashboard");

  return (
    <DashboardLayout user={profile as User}>
      <CreateAssignmentClient user={profile as User} />
    </DashboardLayout>
  );
}
