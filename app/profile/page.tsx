import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ProfileClient } from "@/components/profile/profile-client";
import type { User } from "@/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) redirect("/login");

  return (
    <DashboardLayout user={profile as User}>
      <ProfileClient user={profile as User} />
    </DashboardLayout>
  );
}
