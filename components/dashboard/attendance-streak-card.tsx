"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, Flame, TrendingUp } from "lucide-react";
import { MarqueeText } from "@/components/ui/marquee-text";
import type { Attendance } from "@/types";

interface AttendanceStreakCardProps {
  /** Whether the base data is still loading */
  loading: boolean;
  /** Login streak in days */
  streakDays: number;
  /** Overall attendance rate (0-100) */
  attendanceRate: number;
  /** Today's attendance status, if already marked */
  todayStatus?: string | null;
}

/**
 * Combined "Attendance Status" card: header with a live clock and date,
 * plus three stat tiles — Today, Streak, and Average — all on one
 * emerald gradient card. Icons sit on white circles for contrast.
 */
export function AttendanceStreakCard({
  loading,
  streakDays,
  attendanceRate,
  todayStatus,
}: AttendanceStreakCardProps) {
  const [now, setNow] = useState<Date | null>(null);

  // Live clock — start after mount to avoid hydration mismatch
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Clock: numbers only, 24-hour — no AM/PM suffix
  const clock = now
    ? now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "--:--:--";
  const dateLabel = now
    ? now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const todayLabel =
    todayStatus === "present" ? "Present"
    : todayStatus === "late" ? "Late 🟡"
    : todayStatus === "excused" ? "Excused 🔵"
    : todayStatus === "absent" ? "Absent ❌"
    : "Not checked in";

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20 p-5">
      {/* Header: icon + date | live clock */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">Attendance Status</p>
            <MarqueeText
              text={dateLabel || "\u00a0"}
              duration={7}
              className="text-xs text-emerald-100"
            />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight flex-shrink-0">{clock}</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <Clock className="w-4 h-4 mx-auto mb-1.5 text-emerald-100" />
          <p className="text-[11px] text-emerald-100">Today</p>
          {loading ? (
            <p className="text-sm font-bold mt-0.5">…</p>
          ) : (
            <MarqueeText text={todayLabel} duration={5} className="text-sm font-bold mt-0.5" />
          )}
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <Flame className="w-4 h-4 mx-auto mb-1.5 text-amber-300" />
          <p className="text-[11px] text-emerald-100">Streak</p>
          <p className="text-sm font-bold mt-0.5">{streakDays} days</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1.5 text-emerald-100" />
          <p className="text-[11px] text-emerald-100">Average</p>
          <p className="text-sm font-bold mt-0.5">{attendanceRate}%</p>
        </div>
      </div>
    </div>
  );
}
