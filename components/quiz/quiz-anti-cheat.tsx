"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, Maximize, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QuizAntiCheatProps {
  children: React.ReactNode;
  onForceSubmit: () => void;
  isActive: boolean; // only active when quiz is started
  maxWarnings?: number;
}

export function QuizAntiCheat({
  children,
  onForceSubmit,
  isActive,
  maxWarnings = 3,
}: QuizAntiCheatProps) {
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addWarning = useCallback((reason: string) => {
    if (!isActive) return;
    setWarnings((prev) => {
      const next = prev + 1;
      if (next >= maxWarnings) {
        toast.error("Maximum warnings reached. Quiz auto-submitted!");
        onForceSubmit();
        return next;
      }
      setWarningMessage(reason);
      setShowWarning(true);
      toast.warning(`⚠️ Warning ${next}/${maxWarnings}: ${reason}`);
      return next;
    });
  }, [isActive, maxWarnings, onForceSubmit]);

  // Detect tab/window switch
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addWarning("You switched tabs or minimized the window");
      }
    };

    const handleBlur = () => {
      addWarning("You left the quiz window");
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
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [isActive]);

  // Disable copy-paste and keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+F, F12, Alt+Tab
      if (
        (e.ctrlKey && ["c", "v", "a", "f", "u", "s"].includes(e.key.toLowerCase())) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        toast.warning("This action is not allowed during the quiz");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (isActive && !isFs) {
        setNeedsFullscreen(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isActive]);

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setNeedsFullscreen(false);
      setIsFullscreen(true);
    } catch {
      // Fullscreen not supported or denied
      setNeedsFullscreen(false);
    }
  };

  // Show fullscreen prompt when quiz starts
  useEffect(() => {
    if (isActive && !isFullscreen) {
      setNeedsFullscreen(true);
    }
  }, [isActive]);

  // Warning overlay
  if (showWarning && isActive) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Warning {warnings}/{maxWarnings}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">{warningMessage}</p>
          <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-6">
            {maxWarnings - warnings} warning{maxWarnings - warnings !== 1 ? "s" : ""} remaining before auto-submit
          </p>
          <Button
            className="w-full rounded-xl"
            onClick={() => {
              setShowWarning(false);
              if (!isFullscreen) setNeedsFullscreen(true);
            }}
          >
            I Understand, Continue Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Fullscreen prompt
  if (needsFullscreen && isActive) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Maximize className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Fullscreen Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm">
            This quiz must be taken in fullscreen mode to prevent cheating.
          </p>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl mb-6 text-left">
            <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">During the quiz:</p>
            <ul className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 space-y-0.5">
              <li>• Switching tabs = warning</li>
              <li>• Leaving window = warning</li>
              <li>• {maxWarnings} warnings = auto-submit</li>
              <li>• Right-click disabled</li>
            </ul>
          </div>
          <Button className="w-full rounded-xl gap-2" onClick={enterFullscreen}>
            <Maximize className="w-4 h-4" />
            Enter Fullscreen & Continue
          </Button>
          <button
            onClick={() => setNeedsFullscreen(false)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Skip fullscreen (not recommended)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="select-none"
      style={{ userSelect: "none" }}
    >
      {/* Warning counter badge */}
      {isActive && warnings > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {warnings}/{maxWarnings} warnings
        </div>
      )}

      {/* Anti-cheat indicator */}
      {isActive && (
        <div className="fixed top-4 left-4 z-50 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          Secure Mode
        </div>
      )}

      {children}
    </div>
  );
}
