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

const WEEKS = 20;

// Row order is Mon..Sun (GitHub style) — label a few rows for orientation
const DAY_LABELS: Record<number, string> = { 0: "Sen", 2: "Rab", 4: "Jum" };

/**
 * GitHub-style contribution heatmap for attendance history.
 * One small square per day for the last ~20 weeks, with month labels
 * above the columns and weekday labels on the left:
 *   green   = hadir (emerald = present, lighter = late)
 *   white   = no record / absent (left empty as requested)
 */
export function AttendanceHeatmap({ records, today }: AttendanceHeatmapProps) {
  const { columns, presentCount } = useMemo(() => {
    const ref = today ? new Date(today) : new Date();
    const byDate = new Map<string, string>();
    for (const r of records) {
      if (r?.date) byDate.set(r.date, r.status);
    }

    // Build columns: each column is one week of 7 days (Mon..Sun),
    // ending on the current week so "today" is the last cell.
    const end = new Date(ref);
    end.setDate(end.getDate() + (6 - end.getDay())); // align to Sunday

    const cols: {
      days: { date: string; status?: string; isFuture: boolean; isToday: boolean }[];
      monthLabel?: string;
    }[] = [];
    let present = 0;
    let prevMonthKey = "";

    for (let w = WEEKS - 1; w >= 0; w--) {
      const days: { date: string; status?: string; isFuture: boolean; isToday: boolean }[] = [];
      for (let d = 6; d >= 0; d--) {
        const day = new Date(end);
        day.setDate(end.getDate() - (w * 7 + d));
        const iso = day.toISOString().split("T")[0];
        const status = byDate.get(iso);
        const isFuture = day > ref;
        const isToday = iso === new Date(ref).toISOString().split("T")[0];
        if (status === "present" || status === "late") present++;
        days.push({ date: iso, status, isFuture, isToday });
      }

      // Month label: show on the column where the month (of its Monday) changes
      const monday = new Date(days[0].date);
      const monthKey = `${monday.getFullYear()}-${monday.getMonth()}`;
      const monthLabel =
        monthKey !== prevMonthKey
          ? monday.toLocaleDateString("id-ID", { month: "short" })
          : undefined;
      prevMonthKey = monthKey;

      cols.push({ days, monthLabel });
    }

    return { columns: cols, presentCount: present };
  }, [records, today]);

  const cellColor = (status?: string) => {
    if (status === "present") return "bg-emerald-500";
    if (status === "late") return "bg-emerald-300";
    return "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"; // empty
  };

  const statusLabel = (status?: string) =>
    status === "present"
      ? "Hadir"
      : status === "late"
      ? "Terlambat"
      : status === "absent"
      ? "Absen"
      : status === "excused"
      ? "Izin"
      : "tidak ada absensi";

  const dayTooltip = (iso: string, status?: string) => {
    const d = new Date(iso);
    const label = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${label} — ${statusLabel(status)}`;
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{presentCount}</span> hari hadir
          dalam {WEEKS} minggu terakhir
        </p>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0">
          <span>Kurang</span>
          <span className="w-2.5 h-2.5 rounded-[3px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-300" />
          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />
          <span>Hadir</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-[3px] w-max">
          {/* Weekday labels column */}
          <div className="flex flex-col gap-[3px] flex-shrink-0 pr-0.5">
            <div className="h-3" /> {/* spacer aligned with month-label slot */}
            {Array.from({ length: 7 }).map((_, row) => (
              <div
                key={row}
                className="w-6 h-[11px] flex items-center text-[9px] leading-none text-gray-400 dark:text-gray-500"
              >
                {DAY_LABELS[row] ?? ""}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {columns.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {/* Month label slot — text can overflow right like GitHub */}
              <div className="h-3 w-[11px] text-[9px] leading-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-visible">
                {week.monthLabel ?? ""}
              </div>
              {week.days.map((day) => (
                <div
                  key={day.date}
                  title={day.isFuture ? undefined : dayTooltip(day.date, day.status)}
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
