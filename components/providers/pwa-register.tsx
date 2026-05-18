"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  toast.info("App updated! Refresh to get the latest version.", {
                    action: { label: "Refresh", onClick: () => window.location.reload() },
                  });
                }
              });
            }
          });
        })
        .catch((err) => console.log("SW registration failed:", err));
    }

    // PWA install prompt
    let deferredPrompt: any;
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      // Show install toast after 30 seconds
      setTimeout(() => {
        if (deferredPrompt) {
          toast("Install English LMS as an app for offline access!", {
            action: {
              label: "Install",
              onClick: () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
              },
            },
            duration: 10000,
          });
        }
      }, 30000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return null;
}
