"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QuizAntiCheatProps {
  children: React.ReactNode;
  onForceSubmit: () => void;
  isActive: boolean;
  maxWarnings?: number;
}

// Detect iOS
const isIOS = () =>
  typeof window !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

// Detect Android
const isAndroid = () =>
  typeof window !== "undefined" &&
  /Android/.test(navigator.userAgent);

export function QuizAntiCheat({
  children,
  onForceSubmit,
  isActive,
  maxWarnings = 3,
}: QuizAntiCheatProps) {
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const warningsRef = useRef(0);
  const isActiveRef = useRef(isActive);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const addWarning = useCallback((reason: string) => {
    if (!isActiveRef.current) return;
    warningsRef.current += 1;
    const current = warningsRef.current;
    setWarnings(current);

    if (current >= maxWarnings) {
      toast.error("Maximum warnings reached. Quiz auto-submitted!");
      onForceSubmit();
      return;
    }

    setWarningMessage(reason);
    setShowWarning(true);
    toast.warning(`⚠️ Warning ${current}/${maxWarnings}: ${reason}`);
  }, [maxWarnings, onForceSubmit]);

  // Tab/window visibility detection — works on ALL platforms
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden && isActiveRef.current) {
        addWarning("You switched tabs or minimized the browser");
      }
    };

    const handleBlur = () => {
      // Small delay to avoid false positives
      setTimeout(() => {
        if (document.hidden && isActiveRef.current) {
          addWarning("You left the quiz window");
        }
      }, 500);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isActive, addWarning]);

  // Disable right-click
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [isActive]);

  // Disable keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "a", "f", "u", "s", "p"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === "F12" || e.key === "PrintScreen") e.preventDefault();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isActive]);

  // Fullscreen — try native API, fallback gracefully for iOS
  const enterFullscreen = async () => {
    if (isIOS()) {
      // iOS Safari doesn't support fullscreen API
      // Use a visual "lock" instead — hide browser UI via scroll trick
      window.scrollTo(0, 1);
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
      return;
    }

    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        // Android Chrome
        await (el as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    } catch {
      // Fullscreen failed — continue without it
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    }
  };

  // Show fullscreen prompt when quiz starts
  useEffect(() => {
    if (isActive && !isFullscreen) {
      setShowFullscreenPrompt(true);
    }
    if (!isActive) {
      setShowFullscreenPrompt(false);
      // Exit fullscreen when done
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isActive]);

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && isActive && isFullscreen) {
        // User exited fullscreen manually
        addWarning("You exited fullscreen mode");
        setIsFullscreen(false);
        setShowFullscreenPrompt(true);
      }
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, [isActive, isFullscreen, addWarning]);

  // Warning overlay
  if (showWarning && isActive) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Warning {warnings}/{maxWarnings}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{warningMessage}</p>
          <p className="text-red-600 dark:text-red-400 text-sm font-semibold mb-6">
            {maxWarnings - warnings} warning{maxWarnings - warnings !== 1 ? "s" : ""} left before auto-submit
          </p>
          <Button
            className="w-full rounded-xl h-12 text-base"
            onClick={() => {
              setShowWarning(false);
              if (!isFullscreen && !isIOS()) setShowFullscreenPrompt(true);
            }}
          >
            I Understand, Continue
          </Button>
        </div>
      </div>
    );
  }

  // Fullscreen prompt
  if (showFullscreenPrompt && isActive) {
    const iosDevice = isIOS();
    const androidDevice = isAndroid();

    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Secure Mode
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {iosDevice
              ? "This assessment uses secure mode. Stay on this page while taking the quiz."
              : "This assessment requires focused mode to prevent cheating."}
          </p>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl mb-6 text-left space-y-1.5">
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">Rules during assessment:</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• Switching apps/tabs = warning</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• {maxWarnings} warnings = auto-submit</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• Right-click disabled</p>
            {!iosDevice && <p className="text-xs text-yellow-600 dark:text-yellow-400">• Fullscreen required</p>}
          </div>

          <Button
            className="w-full rounded-xl h-12 text-base gap-2"
            onClick={enterFullscreen}
          >
            <Shield className="w-5 h-5" />
            {iosDevice ? "Start Assessment" : "Enter Fullscreen & Start"}
          </Button>

          <button
            onClick={() => setShowFullscreenPrompt(false)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Skip (not recommended)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      {/* Status indicators */}
      {isActive && (
        <>
          {warnings > 0 && (
            <div className="fixed top-4 right-4 z-50 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {warnings}/{maxWarnings} warnings
            </div>
          )}
          <div className="fixed top-4 left-4 z-50 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Secure Mode
          </div>
        </>
      )}
      {children}
    </div>
  );
}
