"use client";

import { useEffect } from "react";

/**
 * Version-based app update notification.
 *
 * APP_VERSION is bumped on every release (keep in sync with package.json
 * and the service worker cache name). When a client sees a version that
 * differs from the one they last saw/dismissed, the bell shows an
 * "App update available" entry pinned on top for ALL users (students and
 * teachers). Dismissing it stores the version in localStorage, so it
 * never nags again for THAT version — it reappears only for the NEXT
 * shipped version.
 */
export const APP_VERSION = "1.3.1";

const SEEN_KEY = "app-update-version";

/**
 * Whether THIS client has not yet seen/dismissed the current app version.
 * Used by the bell UI on mount — the "app-update-available" event alone is
 * not enough because it only fires once per page load, so components that
 * mount later (client-side navigation) would never hear it.
 */
export function isUpdatePending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== APP_VERSION;
  } catch {
    return true;
  }
}

export function UpdateNotification() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let seenVersion: string | null = null;
    try {
      seenVersion = localStorage.getItem(SEEN_KEY);
    } catch {}

    // New version detected (or first visit) → announce to the bell UI
    if (seenVersion !== APP_VERSION) {
      window.dispatchEvent(
        new CustomEvent("app-update-available", {
          detail: { version: APP_VERSION },
        })
      );
    }

    // Dismissal persists per version — never shows again until the next bump
    const onDismiss = () => {
      try {
        localStorage.setItem(SEEN_KEY, APP_VERSION);
      } catch {}
    };
    window.addEventListener("app-update-dismissed", onDismiss);

    // "Update now" → hard refresh to pick up the new deploy
    const onUpdateNow = () => {
      try {
        localStorage.setItem(SEEN_KEY, APP_VERSION);
      } catch {}
      // Clear SW caches so the reload gets fresh assets, then reload
      const w = window as any;
      if (w.caches?.keys) {
        w.caches.keys().then((keys: string[]) => {
          Promise.all(keys.map((k: string) => w.caches.delete(k))).finally(() => window.location.reload());
        }).catch(() => window.location.reload());
      } else {
        window.location.reload();
      }
    };
    window.addEventListener("app-update-now", onUpdateNow);

    // Keep the service worker fresh in the background (no nagging from here)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {})).catch(() => {});
    }

    return () => {
      window.removeEventListener("app-update-dismissed", onDismiss);
      window.removeEventListener("app-update-now", onUpdateNow);
    };
  }, []);

  return null;
}
