"use client";

import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/push-notifications";
import type { User } from "@/types";

const DISMISS_KEY = "push-banner-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // re-ask after 7 days

/**
 * Prompts the user to enable web push on THIS device.
 * Push is opt-in per browser/device — without subscribing, notifications
 * created in-app never reach the user's phone.
 */
export function PushNotificationBanner({ user }: { user: User }) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // SSR or unsupported browser — never show
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return;

    // Respect recent dismissal — don't nag on every page load
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;

    // Hard-blocked by the user in browser settings — can't re-prompt
    if (Notification.permission === "denied") return;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        // Already subscribed on this device — nothing to ask
        if (Notification.permission === "granted" && subscription) return;
        setVisible(true);
      } catch {
        // Service worker not ready — silently skip
      }
    })();
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const enable = async () => {
    setSubscribing(true);
    const ok = await subscribeToPush(user.id);
    setSubscribing(false);
    if (ok) {
      setVisible(false);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
      toast.success("Notifications enabled! 🔔");
    } else {
      toast.error("Could not enable notifications. Please allow them in the browser settings.");
    }
  };

  if (!visible) return null;

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 p-4">
      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Never miss an assignment 📲</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
          Turn on push notifications to get alerts on this device for new assignments, grades &amp; assessments — even when the app is closed.
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <Button size="sm" className="h-8 rounded-xl gap-1.5" onClick={enable} disabled={subscribing}>
            {subscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            Enable notifications
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-gray-500" onClick={dismiss}>
            Later
          </Button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss notification prompt"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
