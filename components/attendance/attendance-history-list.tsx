"use client";

import { CheckCircle, Clock, XCircle, MailX, History, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Attendance, AttendanceStatus } from "@/types";

const statusConfig: Record<
  AttendanceStatus,
  { label: string; icon: any; bg: string; text: string; color: string }
> = {
  present: { label: "Hadir", icon: CheckCircle, bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-600 dark:text-emerald-400", color: "success" },
  late: { label: "Telat", icon: Clock, bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-500", color: "warning" },
  absent: { label: "Alpha", icon: XCircle, bg: "bg-red-100 dark:bg-red-950", text: "text-red-500", color: "destructive" },
  excused: { label: "Izin", icon: MailX, bg: "bg-sky-100 dark:bg-sky-950", text: "text-sky-500", color: "info" },
};

/**
 * "Riwayat Presensi" card — the same history list shown on the attendance
 * page, reusable on the student dashboard. Shows the most recent `limit`
 * records with status badges.
 */
export function AttendanceHistoryList({
  records,
  loading,
  limit = 10,
}: {
  records: Attendance[];
  loading: boolean;
  limit?: number;
}) {
  const total = records.length;
  const recent = records.slice(0, limit);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
            <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          Riwayat Presensi
        </CardTitle>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 ml-10">
          {total} hari tercatat · {limit > 0 && recent.length > 0 ? `${recent.length} terbaru` : "belum ada data"}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <UserCheck className="w-7 h-7 text-emerald-300 dark:text-emerald-700" />
            </div>
            <p className="font-medium">Belum ada riwayat presensi</p>
            <p className="text-xs mt-1">Absen hari ini lewat menu Attendance, ya!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((record) => {
              const config = statusConfig[record.status as AttendanceStatus];
              const Icon = config?.icon || CheckCircle;
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config?.bg || "bg-gray-100"}`}>
                    <Icon className={`w-4 h-4 ${config?.text || "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(record.date)}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(record.timestamp)}</p>
                  </div>
                  <Badge variant={config?.color as any || "secondary"} className="text-xs whitespace-nowrap">
                    {config?.label || record.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
