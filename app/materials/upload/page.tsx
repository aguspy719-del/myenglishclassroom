import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UploadMaterialClient } from "@/components/materials/upload-material-client";
import type { User } from "@/types";

export default async function UploadMaterialPage() {
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
      <UploadMaterialClient user={profile as User} />
    </DashboardLayout>
  );
}
