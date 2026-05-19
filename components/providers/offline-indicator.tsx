"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
      isOnline
        ? "bg-green-500 text-white"
        : "bg-gray-900 text-white"
    }`}>
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          Back online! Data will sync automatically.
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          You are offline. Showing cached data.
        </>
      )}
    </div>
  );
}
