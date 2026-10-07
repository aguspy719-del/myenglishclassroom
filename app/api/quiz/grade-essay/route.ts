import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/quiz/grade-essay
 * Body: { answerId: string, score: number, feedback?: string }
 *
 * Server-side essay grading — fixes 3 client-side bugs:
 * 1. MC score lost on mixed quizzes (reads mc_score_pct column, not attempt.score)
 * 2. Notification sent before all essays graded (checks all essays have scores)
 * 3. Student could update their own essay score via RLS (now requires teacher role)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Must be authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Must be a teacher
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const body = await request.json();
    const { answerId, score, feedback = "" } = body;

    if (!answerId) {
      return NextResponse.json({ error: "answerId is required" }, { status: 400 });
    }
    if (typeof score !== "number" || score < 0) {
      return NextResponse.json({ error: "score must be a non-negative number" }, { status: 400 });
    }

    // Load the essay answer + its question (for max_score validation)
    const { data: essayAnswer, error: eaErr } = await supabase
      .from("essay_answers")
      .select("id, quiz_id, question_id, student_id, question:quiz_questions(max_score)")
      .eq("id", answerId)
      .single();

    if (eaErr || !essayAnswer) {
      return NextResponse.json({ error: "Essay answer not found" }, { status: 404 });
    }

    const maxScore = Math.max(1, (essayAnswer.question as any)?.max_score ?? 10);
    const clampedScore = Math.min(Math.max(0, Math.round(score)), maxScore);

    // Write score + feedback — using service role so RLS doesn't block it
    const { error: updateErr } = await supabase
      .from("essay_answers")
      .update({ score: clampedScore, feedback: feedback.trim() })
      .eq("id", answerId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { quiz_id: quizId, student_id: studentId } = essayAnswer;

    // ── Bug Fix 1: Recalculate combined score using mc_score_pct ──────────
    // Load all questions for this quiz
    const { data: allQuestions } = await supabase
      .from("quiz_questions")
      .select("id, question_type, max_score");

    const mcQuestions = (allQuestions || []).filter(
      (q: any) => q.question_type !== "essay"
    );
    const essayQuestions = (allQuestions || []).filter(
      (q: any) => q.question_type === "essay"
    );
    const mcMaxPoints = mcQuestions.reduce(
      (sum: number, q: any) => sum + (Math.max(1, q.max_score) || 10), 0
    );
    const essayMaxPoints = essayQuestions.reduce(
      (sum: number, q: any) => sum + (Math.max(1, q.max_score) || 10), 0
    );
    const totalPoints = mcMaxPoints + essayMaxPoints;

    // Load this student's attempt — we read mc_score_pct (not score) to get
    // the original MC performance unaffected by previous partial essay grades
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("id, mc_score_pct")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ ok: true, note: "no attempt found" });
    }

    // Load ALL essay answers for this student in this quiz (including the one just graded)
    const { data: allEssayAnswers } = await supabase
      .from("essay_answers")
      .select("score, question:quiz_questions(max_score)")
      .eq("quiz_id", quizId)
      .eq("student_id", studentId);

    const gradedEssays = (allEssayAnswers || []).filter((ea: any) => ea.score != null);
    const ungradedCount = essayQuestions.length - gradedEssays.length;

    // Calculate essay earned points from all graded essays (ungraded = 0)
    const essayEarnedPoints = (allEssayAnswers || []).reduce((sum: number, ea: any) => {
      if (ea.score == null) return sum; // ungraded = 0 contribution
      const max = Math.max(1, (ea.question as any)?.max_score ?? 10);
      return sum + Math.min(Math.max(0, ea.score), max);
    }, 0);

    // Bug Fix 1: Use mc_score_pct (the original MC %) instead of attempt.score
    const mcPct = attempt.mc_score_pct ?? 0;
    const mcEarnedPoints = mcMaxPoints > 0 ? (mcPct / 100) * mcMaxPoints : 0;

    const combinedScore = totalPoints > 0
      ? Math.round((mcEarnedPoints + essayEarnedPoints) / totalPoints * 100)
      : 0;

    // Always update the attempt score (even if not all graded, so teacher can
    // see partial progress); but only lock in final score when all are graded
    await supabase
      .from("quiz_attempts")
      .update({ score: combinedScore })
      .eq("id", attempt.id);

    // ── Bug Fix 2: Only notify student when ALL essays are graded ──────────
    const allGraded = ungradedCount === 0;

    if (allGraded) {
      // All essays done — send final notification
      try {
        await supabase.from("notifications").insert({
          user_id: studentId,
          title: "📝 Assessment Fully Graded",
          message: `Your final score: ${combinedScore}`,
          type: "grade",
          link: `/quiz/${quizId}`,
        });

        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "supabase.co") || ""}/`, {
          method: "HEAD",
        }).catch(() => {});

        // Push notification via internal API
        const pushRes = await fetch(
          new URL("/api/push/send", request.url).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: [studentId],
              payload: {
                title: "📝 Assessment Fully Graded",
                body: `Final score: ${combinedScore}`,
                url: `/quiz/${quizId}`,
              },
            }),
          }
        );
      } catch {
        // Push failure must not block grading
      }
    }

    return NextResponse.json({
      ok: true,
      score: clampedScore,
      combinedScore,
      allGraded,
      ungradedCount,
    });
  } catch (err: any) {
    console.error("[GradeEssay] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
