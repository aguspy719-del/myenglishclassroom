"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";

/**
 * PWA entrance animation.
 * Shows a short branded splash ONLY when the app is launched in standalone mode
 * (i.e. opened from the installed PWA icon), then fades it away once the page
 * is ready. Regular browser tabs are never affected.
 */
export function PwaEntrance() {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Only inside an installed PWA (Android/Chrome & iOS/Safari standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (!standalone) return;

    setHidden(false);
    // Wait for the first paint + a short branded moment, then fade out
    const hideTimer = setTimeout(() => setLeaving(true), 650);
    const removeTimer = setTimeout(() => setHidden(true), 1100);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className="pwa-splash flex flex-col items-center justify-center"
      data-leaving={leaving ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="pwa-splash-logo w-20 h-20 rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25">
        <Logo size={80} className="w-full h-full" />
      </div>
      <div className="pwa-splash-wordmark text-center mt-4">
        <p className="text-lg font-black text-gray-900 dark:text-white">My Classroom</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">SMK Negeri 1 Buduran</p>
      </div>
    </div>
  );
}
