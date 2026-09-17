"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Attendance } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = [
  { label: "MON", weekend: false },
  { label: "TUE", weekend: false },
  { label: "WED", weekend: false },
  { label: "THU", weekend: false },
  { label: "FRI", weekend: false },
  { label: "SAT", weekend: true },
  { label: "SUN", weekend: true },
];

/** Extract HH:MM check-in time from the record timestamp */
function timeLabel(ts?: string) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

interface AttendanceCalendarProps {
  /** All attendance records for the student */
  records: Attendance[];
  /** Loading state — shows skeleton */
  loading?: boolean;
}

/**
 * Monthly attendance history calendar (reference design):
 * SEN..MIN grid, green = presensi, amber = telat, red = alpha,
 * sky = izin, gray = no record. Each attended day shows the
 * check-in time under the date number.
 */
export function AttendanceCalendar({ records, loading }: AttendanceCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [year, setYear] = useState(now.getFullYear());

  const byDate = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const r of records) if (r?.date) m.set(r.date, r);
    return m;
  }, [records]);

  // Use the same UTC-date convention as the API & dashboard so the
  // "today" ring always matches where attendance records actually land.
  const todayIso = now.toISOString().split("T")[0];

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

    const arr: ({
      day: number;
      iso: string;
      record?: Attendance;
      isFuture: boolean;
      isToday: boolean;
    } | null)[] = [];

    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      arr.push({
        day: d,
        iso,
        record: byDate.get(iso),
        isFuture: iso > todayIso,
        isToday: iso === todayIso,
      });
    }
    return arr;
  }, [year, month, byDate, todayIso]);

  // Month stats
  const monthRecords = cells.filter((c) => c?.record?.status).map((c) => c!.record!);
  const mPresent = monthRecords.filter((r) => r.status === "present").length;
  const mLate = monthRecords.filter((r) => r.status === "late").length;
  const mAbsent = monthRecords.filter((r) => r.status === "absent").length;
  const mExcused = monthRecords.filter((r) => r.status === "excused").length;
  const mRate = monthRecords.length > 0
    ? Math.round(((mPresent + mLate + mExcused) / monthRecords.length) * 100)
    : 0;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 5 + i);

  const cellStyle = (record?: Attendance, isFuture?: boolean, isToday?: boolean) => {
    if (isFuture) return "bg-gray-50 dark:bg-gray-800/40 text-gray-300 dark:text-gray-600";
    const status = record?.status;
    if (status === "present") return "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30";
    if (status === "late") return "bg-amber-400 text-white shadow-sm shadow-amber-400/30";
    if (status === "absent") return "bg-red-100 dark:bg-red-950/60 text-red-500 dark:text-red-400";
    if (status === "excused") return "bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400";
    return "bg-gray-100/80 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500";
  };

  const legendCounts = [
    { label: "Present", dot: "bg-emerald-500", count: mPresent },
    { label: "Late", dot: "bg-amber-400", count: mLate },
    { label: "Excused", dot: "bg-sky-400", count: mExcused },
    { label: "Absent", dot: "bg-red-400", count: mAbsent },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          Kalender Riwayat Presensi
        </CardTitle>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 ml-10">
          Track your attendance rate and check-in times this month
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="flex-1 rounded-xl text-sm font-semibold"            aria-label="Pick month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24 rounded-xl text-sm font-semibold"            aria-label="Pick year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend with per-status counts for the visible month */}
        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
          {legendCounts.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", l.dot)} /> {l.label}
              {l.count > 0 && <span className="font-bold text-gray-800 dark:text-gray-100">{l.count}</span>}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" /> No check-in
          </span>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {DAY_HEADERS.map((d) => (
            <div
              key={d.label}
              className={cn(
                "text-center text-[10px] sm:text-xs font-bold tracking-wide py-1",
                d.weekend ? "text-red-400" : "text-gray-400 dark:text-gray-500"
              )}
            >
              {d.label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-14 sm:h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 select-none">
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={`empty-${i}`} />
              ) : (
                <div
                  key={cell.iso}
                  title={`${cell.day} ${MONTHS[month]} ${year}${
                    cell.record
                      ? ` — ${
                          cell.record.status === "present" ? "Present"
                          : cell.record.status === "late" ? "Late"
                          : cell.record.status === "absent" ? "Absent" : "Excused"
                        }${timeLabel(cell.record.timestamp) ? ` · ${timeLabel(cell.record.timestamp)}` : ""}`
                      : cell.isFuture ? "" : " — No check-in"
                  }`}
                  className={cn(
                    "h-14 sm:h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90",
                    cellStyle(cell.record, cell.isFuture, cell.isToday),
                    cell.isToday && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                  )}
                >
                  <span className="text-sm sm:text-base font-bold leading-none">{cell.day}</span>
                  {cell.record && timeLabel(cell.record.timestamp) && (
                    <span className="text-[9px] sm:text-[10px] font-semibold opacity-90 leading-none">
                      {timeLabel(cell.record.timestamp)}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Month summary */}
        {!loading && monthRecords.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-center">
              <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{mPresent}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Hadir</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-2 text-center">
              <p className="text-base sm:text-lg font-bold text-amber-500">{mLate}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Telat</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-950/60 p-2 text-center">
              <p className="text-base sm:text-lg font-bold text-red-500">{mAbsent}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Alpha</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-2 text-center">
              <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{mRate}%</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Kehadiran</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
