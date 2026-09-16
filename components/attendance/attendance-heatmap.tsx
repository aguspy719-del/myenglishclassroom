"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Attendance } from "@/types";

interface AttendanceHeatmapProps {
  /** Student attendance records (status + date per record) */
  records: Attendance[];
  /** Reference date for "today" (defaults to now) */
  today?: Date;
}

/**
 * GitHub-style contribution heatmap for attendance history.
 * One small square per day for the last ~20 weeks:
 *   green   = hadir (present / late)
 *   emerald = present, lighter = late
 *   white   = no record / absent (left empty as requested)
 * Absent & excused are shown as empty cells to keep it simple and positive.
 */
export function AttendanceHeatmap({ records, today }: AttendanceHeatmapProps) {
  const weeks = 20;

  const { columns, presentCount, totalDays } = useMemo(() => {
    const ref = today ? new Date(today) : new Date();
    const byDate = new Map<string, string>();
    for (const r of records) {
      if (r?.date) byDate.set(r.date, r.status);
    }

    // Build columns: each column is one week of 7 days (Mon..Sun),
    // ending on the current week so "today" is the last cell.
    const end = new Date(ref);
    // Align to Sunday as the last day of the week (GitHub style)
    end.setDate(end.getDate() + (6 - end.getDay()));

    const cols: { date: string; status?: string; isFuture: boolean; isToday: boolean }[][] = [];
    let present = 0;

    for (let w = weeks - 1; w >= 0; w--) {
      const week: { date: string; status?: string; isFuture: boolean; isToday: boolean }[] = [];
      for (let d = 6; d >= 0; d--) {
        const day = new Date(end);
        day.setDate(end.getDate() - (w * 7 + d));
        const iso = day.toISOString().split("T")[0];
        const status = byDate.get(iso);
        const isFuture = day > ref;
        const isToday = iso === new Date(ref).toISOString().split("T")[0];
        if (status === "present" || status === "late") present++;
        week.push({ date: iso, status, isFuture, isToday });
      }
      cols.push(week);
    }

    return { columns: cols, presentCount: present, totalDays: cols.length * 7 };
  }, [records, today]);

  const cellColor = (status?: string) => {
    if (status === "present") return "bg-emerald-500";
    if (status === "late") return "bg-emerald-300";
    return "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"; // empty
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{presentCount}</span> hari hadir
          dalam {weeks} minggu terakhir
        </p>
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>Kurang</span>
          <span className="w-2.5 h-2.5 rounded-[3px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-300" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />
          <span>Hadir</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-[3px] w-max">
          {columns.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={
                    day.isFuture
                      ? undefined
                      : `${new Date(day.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}${day.status ? ` — ${day.status === "present" ? "Hadir" : day.status === "late" ? "Terlambat" : day.status === "absent" ? "Absen" : "Izin"}` : " — tidak ada absensi"}`
                  }
                  className={cn(
                    "w-[11px] h-[11px] rounded-[3px] transition-colors",
                    cellColor(day.status),
                    day.isToday && "ring-2 ring-emerald-600 ring-offset-1 ring-offset-white dark:ring-offset-gray-900",
                    day.isFuture && "opacity-30"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
