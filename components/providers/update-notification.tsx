"use client";

import { useEffect } from "react";

const DISMISS_KEY = "app-update-dismissed";

/**
 * App update notification — appears in the notifications bell.
 *
 * When a new service worker is waiting (new deploy shipped), a DOM event
 * is emitted and the Notifications bell shows an "App update available"
 * entry pinned on top. Dismissing it persists for the session, so it
 * never nags — it only reappears for the NEXT shipped version (new page
 * load after the user updates).
 */
export function UpdateNotification() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {}

    const announce = (detail: { reload: () => void }) => {
      if (dismissed) return;
      window.dispatchEvent(new CustomEvent("app-update-available", { detail }));
    };

    let toastShown = false;
    const showUpdateToast = (reg: ServiceWorkerRegistration) => {
      if (toastShown) return;
      toastShown = true;
      announce({
        reload: () => {
          const sw = reg.waiting || reg.installing;
          if (sw) {
            sw.postMessage({ type: "SKIP_WAITING" });
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              window.location.reload();
            }, { once: true });
            setTimeout(() => window.location.reload(), 1500);
          } else {
            window.location.reload();
          }
        },
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg);

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    }).catch(() => {});

    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {})).catch(() => {});
    }, 60 * 60 * 1000);

    // Listen for dismissal so it stays gone for this version
    const onDismiss = () => {
      try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
      dismissed = true;
    };
    window.addEventListener("app-update-dismissed", onDismiss);

    return () => {
      clearInterval(interval);
      window.removeEventListener("app-update-dismissed", onDismiss);
    };
  }, []);

  return null;
}
