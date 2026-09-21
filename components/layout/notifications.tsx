"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X, CheckCheck, Zap, Trophy, Info, ClipboardList, FileText, Flame, RefreshCw, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import { isUpdatePending, APP_VERSION } from "@/components/providers/update-notification";
import { toast } from "sonner";
import Link from "next/link";

import type { Notification } from "@/types";

interface NotificationsProps {
  userId: string;
}

interface AppUpdateNotice {
  version: string;
}

export function Notifications({ userId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  // ── App update notice (from UpdateNotification provider) ──
  const [updateNotice, setUpdateNotice] = useState<AppUpdateNotice | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    // Check on mount too — the provider only fires its event once per page
    // load, so after client-side navigation this component would miss it.
    if (isUpdatePending()) {
      setUpdateNotice({ version: APP_VERSION });
      setUpdateDismissed(false);
    }
    const onUpdate = (e: Event) => {
      setUpdateNotice((e as CustomEvent<AppUpdateNotice>).detail);
      setUpdateDismissed(false);
    };
    window.addEventListener("app-update-available", onUpdate);
    return () => window.removeEventListener("app-update-available", onUpdate);
  }, []);

  const dismissUpdate = () => {
    setUpdateDismissed(true);
    // Persist per version — dismissed updates never come back
    window.dispatchEvent(new Event("app-update-dismissed"));
  };

  const handleUpdateNow = () => {
    window.dispatchEvent(new Event("app-update-now"));
  };

  const unreadCount = notifications.filter((n) => !n.read).length + (updateNotice && !updateDismissed ? 1 : 0);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    // Real-time subscription — badge updates WITHOUT refresh when the
    // teacher sends an assignment or assessment
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications())
      .subscribe();

    // Fallback polling every 30s — realtime websockets can silently fail
    // (publications not enabled, proxies, sleeping tabs), and a missed event
    // would mean students only see new work after a full refresh.
    const pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 30_000);

    // Also refetch when the tab/window regains focus (covers missed events)
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, fetchNotifications]);

  const markAllRead = async () => {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    // Optimistic remove — instantly disappears from the list
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const supabase = createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete notification");
      fetchNotifications();
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm("Clear all notifications? This cannot be undone.")) return;
    setNotifications([]);
    const supabase = createClient();
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
    if (error) {
      toast.error("Failed to clear notifications");
      fetchNotifications();
    }
  };

  const getIcon = (type: string, title?: string) => {
    if (type === "achievement") return <Trophy className="w-4 h-4 text-amber-500" />;
    if (type === "points") return <Zap className="w-4 h-4 text-emerald-500" />;
    if (title?.includes("Streak")) return <Flame className="w-4 h-4 text-orange-500" />;
    if (title?.includes("Assessment") || title?.includes("Soal")) return <FileText className="w-4 h-4 text-blue-500" />;
    if (type === "assignment" || type === "grade") return <ClipboardList className="w-4 h-4 text-blue-500" />;
    if (type === "info" && title?.includes("Materi")) return <BookOpen className="w-4 h-4 text-teal-500" />;
    return <Info className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-soft">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-14 right-2 left-2 sm:left-auto sm:right-4 z-50 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={clearAllNotifications} className="text-xs text-red-500 dark:text-red-400 hover:underline flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />
                    Clear all
                  </button>
                )}
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {/* App update notice — pinned on top, dismissible once */}
              {updateNotice && !updateDismissed && (
                <div className="flex items-start gap-3 p-4 border-b border-emerald-100 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 animate-in slide-in-from-top-2 duration-300">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Update v{updateNotice.version} available
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">New improvements are ready. Update to the latest version.</p>
                    <button
                      onClick={handleUpdateNow}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-3 py-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Update now
                    </button>
                  </div>
                  <button onClick={dismissUpdate} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Dismiss update notice">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`relative flex items-start gap-3 p-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group ${
                        !notif.read ? "bg-emerald-50/50 dark:bg-emerald-950/30" : ""
                      }`}
                    >
                      <Link
                        href={notif.link || "#"}
                        onClick={() => markRead(notif.id)}
                        className="flex items-start gap-3 flex-1 min-w-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {getIcon(notif.type, notif.title)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{notif.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(notif.created_at)}</p>
                        </div>
                      </Link>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-1 rounded-md text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
