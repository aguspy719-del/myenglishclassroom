"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

export function ProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const completeProgress = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, []);

  useEffect(() => {
    completeProgress();
  }, [pathname, completeProgress]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out shadow-sm"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
