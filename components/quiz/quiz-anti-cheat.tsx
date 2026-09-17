"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, Shield, BellOff, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizAntiCheatProps {
  children: React.ReactNode;
  onForceSubmit: () => void;
  isActive: boolean;
  maxWarnings?: number;
  /** Quiz id — used to log violations server-side */
  quizId?: string;
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
  quizId,
}: QuizAntiCheatProps) {
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const warningsRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const wakeLockRef = useRef<any>(null);
  // Cooldown anti dobel: 1 kejadian (keluar halaman) memicu visibilitychange
  // DAN blur bersamaan — tanpa ini 1 keluar terhitung 2 peringatan.
  const lastWarningAtRef = useRef(0);
  const WARNING_COOLDOWN_MS = 2500;

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const playAlarm = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 1; // MAX volume — cannot be lowered from the page
      osc.connect(gain);
      gain.connect(ctx.destination);
      // 3 sharp bursts
      for (let i = 0; i < 3; i++) {
        gain.gain.setValueAtTime(1, ctx.currentTime + i * 0.45);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.45 + 0.3);
      }
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
      osc.onended = () => ctx.close().catch(() => {});
    } catch (e) {}
  }, []);

  const speakWarning = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([400, 100, 400, 100, 400]);
      }
    } catch (e) {}
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance("Warning! Stay on the assessment page!");
      msg.lang = "en-US";
      msg.rate = 0.9;
      msg.volume = 1;
      window.speechSynthesis.speak(msg);
    } catch (e) {}
  }, []);

  const addWarning = useCallback((reason: string, type: string) => {
    if (!isActiveRef.current) return;

    // Satu kejadian = satu peringatan. Abaikan pemicu ganda dalam jeda singkat.
    const now = Date.now();
    if (now - lastWarningAtRef.current < WARNING_COOLDOWN_MS) return;
    lastWarningAtRef.current = now;

    playAlarm();
    speakWarning();

    warningsRef.current += 1;
    const current = warningsRef.current;
    setWarnings(current);

    // Fire-and-forget server log so violations survive page close
    if (quizId) {
      void fetch("/api/quiz/report-violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, type, detail: reason }),
        keepalive: true,
      }).catch(() => {});
    }

    if (current >= maxWarnings) {
      onForceSubmit();
      return;
    }

    setWarningMessage(reason);
    setShowWarning(true);
  }, [maxWarnings, onForceSubmit, playAlarm, speakWarning, quizId]);

  // Tab/window visibility + FOCUS detection — works on ALL platforms.
  // Any loss of focus during the quiz counts as a warning: this catches
  // switching to Google, opening apps, or tapping phone notifications.
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden && isActiveRef.current) {
        addWarning("You left the assessment page (tab, app or notification)", "tab_switch");
      }
    };

    const handleBlur = () => {
      // Window lost focus (notification shade, app switch, another app took over)
      setTimeout(() => {
        if (!document.hidden && isActiveRef.current && !document.hasFocus()) {
          addWarning("The assessment lost focus — do not open other apps or notifications", "focus_loss");
        }
      }, 800);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isActive, addWarning]);

  // Fullscreen exit detection
  useEffect(() => {
    if (!isActive) return;
    const handler = () => {
      if (!document.fullscreenElement && isActiveRef.current && isFullscreen) {
        addWarning("You exited fullscreen mode", "fullscreen_exit");
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

  // Keep the screen awake during the quiz (prevents the lock screen kicking the student out)
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current.addEventListener?.("release", () => {});
        }
      } catch (e) { /* not supported — fine */ }
    };
    requestWakeLock();
    const onVisible = () => {
      if (!cancelled && document.visibilityState === "visible" && !wakeLockRef.current) requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      try { wakeLockRef.current?.release?.(); } catch (e) {}
      wakeLockRef.current = null;
    };
  }, [isActive]);

  // Clipboard + devtools shortcuts + context menu lockdown
  useEffect(() => {
    if (!isActive) return;

    const noEvent = (e: Event) => e.preventDefault();
    const keyHandler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "f", "u", "s", "p"].includes(k)) {
        e.preventDefault();
      }
      if (e.key === "F12" || e.key === "PrintScreen" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
      }
      if (e.key === "Escape") e.preventDefault(); // don't let Esc leave fullscreen easily
    };
    const copyHandler = (e: ClipboardEvent) => e.preventDefault();

    document.addEventListener("contextmenu", noEvent);
    document.addEventListener("keydown", keyHandler);
    document.addEventListener("copy", copyHandler);
    document.addEventListener("cut", copyHandler);
    document.addEventListener("paste", copyHandler);
    document.addEventListener("dragstart", noEvent);

    return () => {
      document.removeEventListener("contextmenu", noEvent);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("copy", copyHandler);
      document.removeEventListener("cut", copyHandler);
      document.removeEventListener("paste", copyHandler);
      document.removeEventListener("dragstart", noEvent);
    };
  }, [isActive]);

  // Warn before leaving the page (close/refresh/back)
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  const enterFullscreen = async () => {
    // Pre-warm speech synthesis + alarm audio on user gesture (browser policy)
    try {
      if ("speechSynthesis" in window) {
        const warmup = new SpeechSynthesisUtterance(" ");
        warmup.volume = 0;
        window.speechSynthesis.speak(warmup);
      }
    } catch (e) {}

    if (isIOS()) {
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
        await (el as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowFullscreenPrompt(false);
    } catch {
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
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isActive, isFullscreen]);

  // Warning overlay — blocks everything, no way to dismiss without acknowledging.
  // overflow-y-auto + my-auto keeps the dialog fully visible on small screens.
  if (showWarning && isActive) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl my-auto">
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

  // Fullscreen prompt — must enter fullscreen to start (no skip on Android/desktop).
  // overflow-y-auto + my-auto: on short screens the dialog scrolls instead of
  // being cut off above the viewport.
  if (showFullscreenPrompt && isActive) {
    const iosDevice = isIOS();
    const androidDevice = isAndroid();

    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-emerald-700 to-teal-800 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl my-auto">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Secure Mode
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {iosDevice
              ? "This assessment uses secure mode. Stay on this page while taking the quiz."
              : "Fullscreen is required to keep the assessment honest."}
          </p>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl mb-4 text-left space-y-1.5">
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">Rules during assessment:</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• Leaving the page = loud alarm + warning</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• {maxWarnings} warnings = auto-submit</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">• Copy/paste, right-click blocked</p>
            {!iosDevice && <p className="text-xs text-yellow-600 dark:text-yellow-400">• Fullscreen required</p>}
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl mb-6 text-left space-y-1.5">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <BellOff className="w-3.5 h-3.5" /> Before you start:
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              📵 Turn on <b>Do Not Disturb</b> so WhatsApp/message notifications can&apos;t interrupt you. Opening
              notifications or leaving this page counts as cheating.
            </p>
          </div>

          <Button
            className="w-full rounded-xl h-12 text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={enterFullscreen}
          >
            <Shield className="w-5 h-5" />
            {iosDevice ? "Start Assessment" : "Enter Fullscreen & Start"}
          </Button>
          {androidDevice && !iosDevice && (
            <p className="text-[11px] text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Focus className="w-3 h-3" /> Pin the app screen for extra focus if available
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
      {/* Hide bottom nav during active quiz */}
      {isActive && (
        <style>{`.bottom-nav { display: none !important; }`}</style>
      )}
      {/* Status indicators */}
      {isActive && (
        <>
          {warnings > 0 && (
            <div className="fixed top-3 right-3 z-50 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {warnings}/{maxWarnings} warnings
            </div>
          )}
          <div className="fixed top-3 left-3 z-50 bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Secure Mode
          </div>
        </>
      )}
      {children}
    </div>
  );
}
