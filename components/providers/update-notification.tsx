"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * In-app update notification.
 *
 * The service worker cache name is versioned (english-lms-vN). When a deploy
 * changes it, the fresh worker installs and waits — this component detects
 * the waiting worker and shows an English toast: "A new version is
 * available" with a one-tap Update button that activates it and reloads.
 */
export function UpdateNotification() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let toastShown = false;

    const showUpdateToast = (reg: ServiceWorkerRegistration) => {
      if (toastShown) return;
      toastShown = true;
      toast("A new version is available", {
        id: "app-update",
        description: "Refresh to get the latest improvements.",
        duration: Infinity,
        action: {
          label: "Update",
          onClick: () => {
            const sw = reg.waiting || reg.installing;
            if (sw) {
              sw.postMessage({ type: "SKIP_WAITING" });
              navigator.serviceWorker.addEventListener("controllerchange", () => {
                window.location.reload();
              }, { once: true });
              // Fallback if controllerchange doesn't fire promptly
              setTimeout(() => window.location.reload(), 1500);
            } else {
              window.location.reload();
            }
          },
        },
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      // A worker is already waiting (e.g. the page loaded right after a deploy)
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // Only prompt when there is an existing controller (a genuine update,
          // not the very first install)
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    }).catch(() => {});

    // Check for a new worker periodically while the app stays open
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {})).catch(() => {});
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
