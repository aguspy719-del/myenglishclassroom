import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AssignmentDetailClient } from "@/components/assignments/assignment-detail-client";
import type { User } from "@/types";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [profileRes, assignmentRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase.from("assignments").select("*, class:classes(class_name, major)").eq("id", id).single(),
  ]);

  if (!profileRes.data) redirect("/login");
  if (!assignmentRes.data) notFound();

  return (
    <DashboardLayout user={profileRes.data as User}>
      <AssignmentDetailClient user={profileRes.data as User} assignment={assignmentRes.data} />
    </DashboardLayout>
  );
}
