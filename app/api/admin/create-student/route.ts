import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verify caller is a teacher
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, email, password, class_id } = await request.json();

    if (!name || !email || !password || !class_id) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Use service role to create auth user
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm email
      user_metadata: { name, role: "student", class_id },
    });

    if (createError) {
      return NextResponse.json({
        error: createError.message.includes("already registered")
          ? "Email already registered"
          : createError.message
      }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Wait for trigger, then upsert profile
    await new Promise((r) => setTimeout(r, 500));

    const { error: profileError } = await adminClient.from("users").upsert({
      id: newUser.user.id,
      name,
      email,
      role: "student",
      class_id,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      // Try update instead
      await adminClient.from("users")
        .update({ name, class_id, role: "student" })
        .eq("id", newUser.user.id);
    }

    return NextResponse.json({ success: true, userId: newUser.user.id });
  } catch (err: any) {
    console.error("[Create Student] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
