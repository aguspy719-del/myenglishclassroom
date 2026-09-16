"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Attendance } from "@/types";

interface AttendanceHeatmapProps {
  /** Student attendance records (status + date per record) */
  records: Attendance[];
  /** Reference date for "today" (defaults to now) */
  today?: Date;
  /** Week count (rows will follow Sen..Min) */
  weeks?: number;
}

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Attendance heatmap like the reference design: rows = weekdays (Sen..Min),
 * columns = weeks. Green = hadir, yellow = terlambat, white = alpha/empty.
 */
export function AttendanceHeatmap({ records, today, weeks = 14 }: AttendanceHeatmapProps) {
  const { rows, presentCount } = useMemo(() => {
    const ref = today ? new Date(today) : new Date();
    const byDate = new Map<string, string>();
    for (const r of records) {
      if (r?.date) byDate.set(r.date, r.status);
    }

    // Columns = weeks, oldest first; each column runs Mon..Sun.
    // Anchor: the Monday of the current week.
    const monday = new Date(ref);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    const cols: {
      days: { date: string; status?: string; isFuture: boolean; isToday: boolean; weekday: number }[];
    }[] = [];
    let present = 0;

    for (let w = weeks - 1; w >= 0; w--) {
      const days: { date: string; status?: string; isFuture: boolean; isToday: boolean; weekday: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() - w * 7 + d);
        const iso = day.toISOString().split("T")[0];
        const status = byDate.get(iso);
        const isFuture = day > ref;
        const isToday = iso === new Date(ref).toISOString().split("T")[0];
        if (status === "present" || status === "late") present++;
        days.push({ date: iso, status, isFuture, isToday, weekday: d });
      }
      cols.push({ days });
    }

    // Transpose into rows (Sen..Min)
    const rowsData = DAY_LABELS.map((_, weekday) =>
      cols.map((c) => c.days[weekday])
    );

    return { rows: rowsData, presentCount: present };
  }, [records, today, weeks]);

  const cellColor = (status?: string) => {
    if (status === "present") return "bg-emerald-500";
    if (status === "late") return "bg-amber-400";
    return "bg-white/90"; // alpha / no record
  };

  const statusLabel = (status?: string) =>
    status === "present"
      ? "Hadir"
      : status === "late"
      ? "Terlambat"
      : status === "absent"
      ? "Alpha"
      : status === "excused"
      ? "Izin"
      : "Alpha";

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
      <p className="text-xs text-white/80 mb-2.5">
        <span className="font-bold text-white">{presentCount}</span> hari hadir dalam {weeks} minggu terakhir
      </p>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-2 w-max">
          {/* Weekday labels */}
          <div className="flex flex-col justify-between flex-shrink-0">
            {DAY_LABELS.map((d) => (
              <div key={d} className="h-[14px] flex items-center text-[9px] leading-none text-white/70 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Week columns — each column has 7 stacked cells (Sen..Min) */}
          <div className="flex gap-[4px]">
            {rows[0].map((_, wi) => (
              <div key={wi} className="flex flex-col gap-[4px]">
                {rows.map((row, ri) => {
                  const day = row[wi];
                  return (
                    <div
                      key={ri}
                      title={day.isFuture ? undefined : dayTooltip(day.date, day.status)}
                      className={cn(
                        "w-[14px] h-[14px] rounded-[4px] transition-colors",
                        cellColor(day.status),
                        day.isToday && "ring-2 ring-white ring-offset-1 ring-offset-emerald-600",
                        day.isFuture && "opacity-30"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-white/80">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Hadir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Telat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/90" /> Alpha
        </span>
      </div>
    </div>
  );
}
