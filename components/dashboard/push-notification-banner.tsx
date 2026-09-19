"use client";

import { useEffect, useState } from "react";
import { Bell, X, Loader2, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/push-notifications";
import type { User } from "@/types";

const DISMISS_KEY = "push-banner-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // re-ask after 7 days

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ identifies itself as macOS with touch support
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true);

/**
 * Prompts the user to enable web push on THIS device.
 * Push is opt-in per browser/device — without subscribing, notifications
 * created in-app never reach the user's phone.
 */
export function PushNotificationBanner({ user }: { user: User }) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

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
        // Only installed PWAs can receive pushes while the app is closed —
        // regular Safari tabs are throttled/killed by iOS in the background.
        if (isIOS() && !isStandalone()) {
          setShowIOSHelp(true);
        }
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
    // iOS Safari needs the app installed to home screen first, otherwise
    // permission can't even be requested.
    if (isIOS() && !isStandalone() && !showIOSHelp) {
      setShowIOSHelp(true);
      return;
    }
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
      const iOSDevice = isIOS() && !isStandalone();
      toast.error(
        iOSDevice
          ? "Install the app to Home Screen first (Share → Add to Home Screen), then enable notifications inside the installed app."
          : "Could not enable notifications. Please allow them in the browser settings."
      );
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
        {showIOSHelp && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">📱 iPhone/iPad: install dulu ke Home Screen</p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] leading-relaxed">
              <li>
                Tap ikon <Share className="w-3 h-3 inline -mt-0.5" /> <b>Share</b> di bawah Safari
              </li>
              <li>
                Pilih <b>Add to Home Screen</b>
              </li>
              <li>
                Buka aplikasi dari Home Screen, lalu tap <b>Enable notifications</b> di sini
              </li>
            </ol>
          </div>
        )}
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
