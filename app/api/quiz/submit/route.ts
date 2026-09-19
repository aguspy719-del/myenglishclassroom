import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/quiz/submit
 * Body: { quizId: string, mc: Record<questionId, "a"|"b"|"c"|"d">, essays: Record<questionId, string> }
 *
 * Server-side grading:
 * - correct answers NEVER reach the student's browser (blocks devtools cheating)
 * - server enforces: schedule window, closed deadline, one attempt, question shuffle integrity
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, class_id")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "student") {
      return NextResponse.json({ error: "Students only" }, { status: 403 });
    }

    const body = await request.json();
    const quizId: string = body?.quizId;
    const mc: Record<string, string> = body?.mc || {};
    const essays: Record<string, string> = body?.essays || {};
    if (!quizId) {
      return NextResponse.json({ error: "quizId is required" }, { status: 400 });
    }

    // Load quiz and verify access window
    const { data: quiz, error: quizErr } = await supabase
      .from("quizzes")
      .select("id, title, class_id, is_published, published_at, available_until")
      .eq("id", quizId)
      .single();
    if (quizErr || !quiz) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (quiz.class_id !== profile.class_id) {
      return NextResponse.json({ error: "This assessment is not for your class" }, { status: 403 });
    }
    const now = new Date();
    // Scheduled quizzes open automatically once published_at passes (no cron needed)
    const notSent = !quiz.is_published &&
      (!quiz.published_at || new Date(quiz.published_at) > now);
    if (notSent) {
      return NextResponse.json({ error: "This assessment has not been sent yet" }, { status: 403 });
    }
    if (quiz.available_until && new Date(quiz.available_until) < now) {
      return NextResponse.json({ error: "This assessment is closed" }, { status: 403 });
    }

    // One attempt only
    const { data: existing } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quizId)
      .eq("student_id", user.id)
      .not("completed_at", "is", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already submitted this assessment" }, { status: 409 });
    }

    // Load questions with correct answers (stays on the server)
    const { data: questions, error: qErr } = await supabase
      .from("quiz_questions")
      .select("id, question, question_type, correct_answer, max_score")
      .eq("quiz_id", quizId)
      .order("order_number");
    if (qErr || !questions || questions.length === 0) {
      return NextResponse.json({ error: "This assessment has no questions" }, { status: 400 });
    }

    // Weighted scoring across ALL questions (MC + essay).
    // MC is auto-graded here; essays are graded later by the teacher.
    const mcQuestions = questions.filter(
      (q) => (q as any).question_type !== "essay"
    );
    const essayQuestions = questions.filter(
      (q) => (q as any).question_type === "essay"
    );
    const validMc = new Set(mcQuestions.map((q) => q.id));
    const mcMaxPoints = mcQuestions.reduce(
      (sum, q) => sum + (Math.max(1, (q as any).max_score) || 10),
      0
    );
    const mcEarnedPoints = mcQuestions.reduce((sum, q) => {
      const answer = mc[q.id];
      const isCorrect = answer && validMc.has(q.id) && answer === q.correct_answer;
      return sum + (isCorrect ? Math.max(1, (q as any).max_score) || 10 : 0);
    }, 0);
    const correctCount = mcQuestions.filter(
      (q) => mc[q.id] && validMc.has(q.id) && mc[q.id] === q.correct_answer
    ).length;
    // MC performance as a percentage of MC points only — shown to the
    // student right after submit, BEFORE essays are graded.
    const mcScorePct = mcMaxPoints > 0
      ? Math.round((mcEarnedPoints / mcMaxPoints) * 100)
      : 0;
    // A quiz with essays has NO final score until the teacher grades them:
    // the attempt row stays score=NULL ("waiting for teacher" everywhere).
    // Storing the MC-only percentage as the final score used to display a
    // misleading 100 for mixed quizzes.
    const hasEssays = essayQuestions.length > 0;
    const essayOnly = hasEssays && mcQuestions.length === 0;

    const submittedAt = new Date().toISOString();

    const { data: attempt, error: attemptErr } = await supabase
      .from("quiz_attempts")
      .insert([{
        quiz_id: quizId,
        student_id: user.id,
        score: hasEssays ? null : mcScorePct,
        started_at: submittedAt,
        completed_at: submittedAt,
        // Store MC answers so the student and teacher can review them later
        answers: mc,
      }])
      .select("id, score")
      .single();
    if (attemptErr || !attempt) {
      console.error("[QuizSubmit] attempt insert failed:", attemptErr);
      return NextResponse.json(
        { error: "Failed to save your attempt. Please contact your teacher." },
        { status: 500 }
      );
    }

    // Attach any pre-submit violations (logged while the attempt was in progress)
    const { data: orphanViolations } = await supabase
      .from("quiz_violations")
      .update({ attempt_id: attempt.id })
      .eq("quiz_id", quizId)
      .eq("student_id", user.id)
      .is("attempt_id", null)
      .select("id");
    if (orphanViolations && orphanViolations.length > 0) {
      await supabase
        .from("quiz_attempts")
        .update({ violations: orphanViolations.length })
        .eq("id", attempt.id);
    }

    // Save essay answers
    for (const q of questions) {
      if ((q as any).question_type === "essay" && essays[q.id]) {
        await supabase.from("essay_answers").insert({
          quiz_id: quizId,
          question_id: q.id,
          student_id: user.id,
          answer: String(essays[q.id]).slice(0, 10000),
          submitted_at: submittedAt,
        });
      }
    }

    // Gamification (best-effort, never blocks the result)
    // Reward diligence: finishing the assessment earns base XP regardless of score.
    // Score bonuses only apply when the final score is already known (no essays);
    // essay quizzes get their bonus after the teacher grades them.
    try {
      const { awardPoints } = await import("@/lib/gamification");
      await awardPoints(user.id, 25, `completing ${quiz.title}`);
      if (!hasEssays && mcScorePct >= 75) {
        await awardPoints(user.id, 100, `great score on ${quiz.title}`);
      }
      if (!hasEssays && mcScorePct === 100 && mcQuestions.length > 0) {
        const { awardBadge } = await import("@/lib/gamification");
        await awardBadge(user.id, "perfect_score");
      }
    } catch (e) {
      console.warn("[QuizSubmit] gamification skipped:", e);
    }

    return NextResponse.json({
      ok: true,
      // NULL = final score pending (essays not graded yet)
      score: hasEssays ? null : mcScorePct,
      mcScore: mcScorePct,
      correctCount,
      mcCount: mcQuestions.length,
      essaySaved: Object.keys(essays).filter((id) => questions.some((q) => q.id === id)).length,
    });
  } catch (err: any) {
    console.error("[QuizSubmit] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
