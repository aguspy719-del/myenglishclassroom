import { createClient } from "@/lib/supabase/client";

export const BADGES = [
  { id: "first_quiz", name: "First Step", description: "Complete your first assessment", icon: "🎯", color: "from-blue-400 to-blue-600" },
  { id: "perfect_score", name: "Perfect Score", description: "Get 100 on any assessment", icon: "💯", color: "from-yellow-400 to-orange-500" },
  { id: "grammar_master", name: "Grammar Master", description: "Score 90+ on 3 assessments", icon: "📚", color: "from-green-400 to-green-600" },
  { id: "interview_ready", name: "Interview Ready", description: "Complete speaking practice", icon: "🎤", color: "from-purple-400 to-purple-600" },
  { id: "streak_5", name: "On Fire", description: "Submit 5 assignments in a row", icon: "🔥", color: "from-red-400 to-orange-500" },
  { id: "level_5", name: "Rising Star", description: "Reach Level 5", icon: "⭐", color: "from-yellow-300 to-yellow-500" },
  { id: "level_10", name: "English Pro", description: "Reach Level 10", icon: "🏆", color: "from-amber-400 to-amber-600" },
  { id: "attendance_100", name: "Perfect Attendance", description: "100% attendance in a month", icon: "✅", color: "from-teal-400 to-teal-600" },
];

export const POINTS_PER_QUIZ = 100;
export const POINTS_PER_LEVEL = 500;

export async function awardPoints(studentId: string, points: number, reason: string) {
  const supabase = createClient();

  // Get current user data
  const { data: user } = await supabase
    .from("users")
    .select("points, level, badges")
    .eq("id", studentId)
    .single();

  if (!user) return;

  const newPoints = (user.points || 0) + points;
  const newLevel = Math.floor(newPoints / POINTS_PER_LEVEL) + 1;
  const leveledUp = newLevel > (user.level || 1);

  // Check for new badges
  const currentBadges: string[] = user.badges || [];
  const newBadges: string[] = [...currentBadges];

  // First quiz badge
  if (!currentBadges.includes("first_quiz")) {
    newBadges.push("first_quiz");
  }

  // Level badges
  if (newLevel >= 5 && !currentBadges.includes("level_5")) newBadges.push("level_5");
  if (newLevel >= 10 && !currentBadges.includes("level_10")) newBadges.push("level_10");

  // Update user
  await supabase.from("users").update({
    points: newPoints,
    level: newLevel,
    badges: newBadges,
  }).eq("id", studentId);

  // Send notification
  const messages = [];
  if (points > 0) messages.push(`+${points} XP for ${reason}`);
  if (leveledUp) messages.push(`🎉 Level Up! You are now Level ${newLevel}`);
  const earnedBadges = newBadges.filter((b) => !currentBadges.includes(b));
  earnedBadges.forEach((b) => {
    const badge = BADGES.find((bd) => bd.id === b);
    if (badge) messages.push(`🏅 New Badge: ${badge.name}`);
  });

  if (messages.length > 0) {
    await supabase.from("notifications").insert(
      messages.map((msg) => ({
        user_id: studentId,
        title: leveledUp ? "Level Up!" : "Points Earned!",
        message: msg,
        type: leveledUp ? "achievement" : "points",
        link: "/profile",
      }))
    );
  }

  return { newPoints, newLevel, leveledUp, earnedBadges };
}

export async function awardBadge(studentId: string, badgeId: string) {
  const supabase = createClient();
  const { data: user } = await supabase.from("users").select("badges").eq("id", studentId).single();
  if (!user) return;

  const currentBadges: string[] = user.badges || [];
  if (currentBadges.includes(badgeId)) return;

  const newBadges = [...currentBadges, badgeId];
  await supabase.from("users").update({ badges: newBadges }).eq("id", studentId);

  const badge = BADGES.find((b) => b.id === badgeId);
  if (badge) {
    await supabase.from("notifications").insert([{
      user_id: studentId,
      title: "New Badge Earned!",
      message: `🏅 You earned the "${badge.name}" badge: ${badge.description}`,
      type: "achievement",
      link: "/profile",
    }]);
  }
}
