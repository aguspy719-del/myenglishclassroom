"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, Flame, TrendingUp } from "lucide-react";
import { AttendanceHeatmap } from "@/components/attendance/attendance-heatmap";
import type { Attendance } from "@/types";

interface AttendanceStreakCardProps {
  /** Attendance records for the heatmap */
  records: Attendance[];
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
 * Combined "Status Kehadiran" card (reference-style): header with a live
 * clock and date, the GitHub-style heatmap, and three stat tiles —
 * Hari Ini, Streak, and Rata-rata — all on one emerald gradient card.
 */
export function AttendanceStreakCard({
  records,
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

  const clock = now
    ? now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\./g, ":")
    : "--:--:--";
  const dateLabel = now
    ? now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const todayLabel =
    todayStatus === "present" ? "Hadir ✅" : todayStatus === "late" ? "Telat 🟡" : "Belum absen";

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20 p-5">
      {/* Header: icon + date | live clock */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight">Status Kehadiran</p>
            <p className="text-xs text-emerald-100 truncate">{dateLabel || "\u00a0"}</p>
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight flex-shrink-0">{clock}</p>
      </div>

      {/* Heatmap panel */}
      <div className="mt-4 rounded-2xl bg-white/10 p-4">
        <p className="text-sm font-semibold mb-3">Kehadiran 3 Bulan Terakhir</p>
        {loading ? (
          <div className="h-28 bg-white/10 rounded-xl animate-pulse" />
        ) : (
          <AttendanceHeatmap records={records} weeks={14} />
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <Clock className="w-4 h-4 mx-auto mb-1.5 text-emerald-100" />
          <p className="text-[11px] text-emerald-100">Hari Ini</p>
          <p className="text-sm font-bold mt-0.5 truncate">{loading ? "…" : todayLabel}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <Flame className="w-4 h-4 mx-auto mb-1.5 text-amber-300" />
          <p className="text-[11px] text-emerald-100">Streak</p>
          <p className="text-sm font-bold mt-0.5">{streakDays} hari</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1.5 text-emerald-100" />
          <p className="text-[11px] text-emerald-100">Rata-rata</p>
          <p className="text-sm font-bold mt-0.5">{attendanceRate}%</p>
        </div>
      </div>
    </div>
  );
}
