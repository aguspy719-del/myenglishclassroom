import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ClassesClient } from "@/components/classes/classes-client";
import type { User } from "@/types";

export default async function ClassesPage() {
  const supabase = createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profile) redirect("/login");

  const user: User = profile;

  return (
    <DashboardLayout user={user}>
      <ClassesClient user={user} />
    </DashboardLayout>
  );
}
