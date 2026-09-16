import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Daily login streak rewards — "rajin masuk" XP.
// Idempotent: max ONE bonus per calendar day per student.
// Streak: consecutive days with a login (yesterday -> streak+1, else reset to 1).
const STREAK_BASE_XP = 10;
const STREAK_BONUS_XP = 5; // +5 XP per consecutive day
const MAX_STREAK_XP = 50; // cap: 50 XP/day max

function yesterdayISO(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return y.toISOString().split("T")[0];
}

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users")
      .select("id, role, points, level, badges, login_streak, last_login_date")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "student") {
      return NextResponse.json({ ok: true, skipped: "students only" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Already claimed today — nothing to do
    if (profile.last_login_date === today) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        streak: profile.login_streak || 0,
        points: profile.points || 0,
        xpAwarded: 0,
      });
    }

    // Compute the new streak
    const prevStreak = profile.login_streak || 0;
    const newStreak = profile.last_login_date === yesterdayISO() ? prevStreak + 1 : 1;

    // XP grows with the streak, capped at MAX_STREAK_XP
    const xpAwarded = Math.min(
      STREAK_BASE_XP + Math.max(0, newStreak - 1) * STREAK_BONUS_XP,
      MAX_STREAK_XP
    );

    const newPoints = (profile.points || 0) + xpAwarded;
    const newLevel = Math.floor(newPoints / 500) + 1;

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        login_streak: newStreak,
        last_login_date: today,
        points: newPoints,
        level: newLevel,
      })
      .eq("id", profile.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify the student (shows up instantly via the realtime bell)
    await supabase.from("notifications").insert([{
      user_id: profile.id,
      title: "🔥 Daily Streak!",
      message: `Day ${newStreak} in a row! +${xpAwarded} XP for showing up today.`,
      type: "points",
      link: "/dashboard",
    }]);

    // Milestone badges
    try {
      const { awardBadge } = await import("@/lib/gamification");
      if (newStreak >= 7) await awardBadge(profile.id, "streak_7");
      if (newStreak >= 30) await awardBadge(profile.id, "streak_30");
    } catch { /* badge failure must not break the flow */ }

    return NextResponse.json({
      ok: true,
      alreadyClaimed: false,
      streak: newStreak,
      points: newPoints,
      level: newLevel,
      xpAwarded,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
