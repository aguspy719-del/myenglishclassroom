import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClassDetailClient } from "@/components/classes/class-detail-client";
import type { User } from "@/types";

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [profileRes, classRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", authUser.id).single(),
    supabase.from("classes").select("*").eq("id", params.id).single(),
  ]);

  if (!profileRes.data) redirect("/login");
  if (!classRes.data) notFound();

  const user: User = profileRes.data;

  return (
    <DashboardLayout user={user}>
      <ClassDetailClient user={user} classData={classRes.data} />
    </DashboardLayout>
  );
}
