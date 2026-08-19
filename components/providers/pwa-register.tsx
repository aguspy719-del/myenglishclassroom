"use client";

import { useEffect, useState } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { requestNotificationPermission } from "@/lib/push-notifications";

export function PWARegister() {
  const [showBanner, setShowBanner] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Listen for sync messages from SW
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "SYNC_DATA") {
            // Trigger page refresh when back online
            window.location.reload();
          }
        });
      }).catch(() => {});
    }

    // Don't show if already installed as PWA
    const installed = window.matchMedia("(display-mode: standalone)").matches;
    if (installed) return;

    // Check if user minimized it this session
    const minimizedSession = sessionStorage.getItem("pwa-minimized");
    if (minimizedSession) setMinimized(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after 30 seconds
      setTimeout(() => setShowBanner(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);

    // After install, ask for notification permission
    if (outcome === "accepted") {
      await requestNotificationPermission();
    }
  };

  const handleMinimize = () => {
    setMinimized(true);
    sessionStorage.setItem("pwa-minimized", "1");
  };

  const handleExpand = () => {
    setMinimized(false);
    sessionStorage.removeItem("pwa-minimized");
  };

  if (!showBanner) return null;

  // Minimized — just a small floating button
  if (minimized) {
    return (
      <button
        onClick={handleExpand}
        className="fixed bottom-24 lg:bottom-6 right-4 z-50 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110"
        title="Install App"
      >
        <Smartphone className="w-5 h-5" />
      </button>
    );
  }

  // Full banner — small, non-blocking, at bottom right
  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 w-72 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-white" />
            <p className="text-white text-sm font-semibold">Install My Classroom</p>
          </div>
          <button
            onClick={handleMinimize}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Minimize"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Install as an app for faster access and offline use — no App Store needed!
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={handleMinimize}
              className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
