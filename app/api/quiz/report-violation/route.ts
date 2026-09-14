import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/quiz/report-violation
 * Body: { quizId: string, type: string, detail?: string }
 * Logs an anti-cheat event (tab switch, fullscreen exit, etc.) server-side
 * so it cannot be blocked by the student's browser.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await request.json();
    const quizId: string = body?.quizId;
    const type: string = body?.type;
    if (!quizId || !type) {
      return NextResponse.json({ error: "quizId and type are required" }, { status: 400 });
    }

    // Verify the student has access to this quiz
    const { data: profile } = await supabase
      .from("users")
      .select("role, class_id")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Students only" }, { status: 403 });
    }

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id, class_id")
      .eq("id", quizId)
      .single();
    if (!quiz || quiz.class_id !== profile.class_id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Insert violation
    const { data: violation, error } = await supabase
      .from("quiz_violations")
      .insert({
        quiz_id: quizId,
        student_id: user.id,
        type: String(type).slice(0, 50),
        detail: body?.detail ? String(body.detail).slice(0, 200) : null,
      })
      .select("id")
      .single();
    if (error || !violation) {
      console.error("[Violation] insert failed:", error);
      return NextResponse.json({ error: "Failed to log violation" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, violationId: violation.id });
  } catch (err: any) {
    console.error("[Violation] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
