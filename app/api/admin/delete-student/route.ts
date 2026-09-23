import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/delete-student
 * Permanently deletes a student account and ALL of their data.
 *
 * Why not just auth.admin.deleteUser()?
 * That only works if every FK back to users/auth.users has ON DELETE CASCADE.
 * Tables created later (e.g. essay_answers) may be missing the cascade, which
 * made deletion fail with "Database error deleting user". So we explicitly
 * delete every dependent row first, then the profile row, then the auth user.
 * If the auth delete fails afterwards, the profile row is restored so the
 * account is never left half-deleted.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify caller is a teacher
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentId } = await request.json();
    if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("[DeleteStudent] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        { error: "Server is not configured for account deletion (missing service role key)" },
        { status: 500 }
      );
    }

    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Snapshot the profile first so we can restore it if a later step fails
    const { data: target } = await adminClient
      .from("users")
      .select("id, name, email, role, class_id")
      .eq("id", studentId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (target.role !== "student") {
      return NextResponse.json({ error: "Only student accounts can be deleted here" }, { status: 403 });
    }

    // 1. Delete dependent rows explicitly (best-effort — a missing table or
    //    column must not block the deletion itself; FK cascades, where they
    //    exist, cover the rest).
    const cleanupSteps = [
      adminClient.from("quiz_violations").delete().eq("student_id", studentId),
      adminClient.from("essay_answers").delete().eq("student_id", studentId),
      adminClient.from("submissions").delete().eq("student_id", studentId),
      adminClient.from("quiz_attempts").delete().eq("student_id", studentId),
      adminClient.from("attendance").delete().eq("student_id", studentId),
      adminClient.from("notifications").delete().eq("user_id", studentId),
      adminClient.from("push_subscriptions").delete().eq("user_id", studentId),
      adminClient.from("push_sent").delete().eq("user_id", studentId),
    ];
    for (const step of cleanupSteps) {
      const { error } = await step;
      if (error) console.warn("[DeleteStudent] cleanup warning:", error.message);
    }

    // 2. Delete the public profile row
    const { error: profileDeleteError } = await adminClient
      .from("users")
      .delete()
      .eq("id", studentId);
    if (profileDeleteError) {
      console.error("[DeleteStudent] profile delete failed:", profileDeleteError);
      return NextResponse.json(
        { error: "Gagal menghapus data siswa: " + profileDeleteError.message },
        { status: 500 }
      );
    }

    // 3. Delete the auth user (last)
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(studentId);
    if (authDeleteError) {
      console.error("[DeleteStudent] auth delete failed:", authDeleteError);
      // Restore the profile row so the account is not left half-deleted
      await adminClient.from("users").upsert({
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        class_id: target.class_id,
      }, { onConflict: "id" });
      return NextResponse.json(
        { error: "Gagal menghapus akun: " + authDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DeleteStudent] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
