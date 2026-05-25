"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, RotateCcw, ChevronRight, ChevronLeft, Volume2, Star, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { awardBadge, awardPoints } from "@/lib/gamification";
import type { User } from "@/types";

interface SpeakingClientProps {
  user: User;
}

const SCENARIOS = [
  {
    id: "job_interview_1",
    category: "Job Interview",
    title: "Self Introduction",
    prompt: "Introduce yourself to the interviewer",
    targetAnswer: "Good morning. My name is [Name]. I am a graduate from SMK Negeri 1 Buduran, majoring in Fashion Design. I am very interested in this position because I believe my skills match the requirements.",
    tips: ["Speak clearly and confidently", "Mention your name and school", "State why you are interested"],
    difficulty: "Beginner",
  },
  {
    id: "job_interview_2",
    category: "Job Interview",
    title: "Strengths & Weaknesses",
    prompt: "What are your strengths and weaknesses?",
    targetAnswer: "My greatest strength is my attention to detail and my ability to work in a team. I am also a fast learner. As for my weakness, I sometimes spend too much time perfecting my work, but I am learning to manage my time better.",
    tips: ["Be honest but positive", "Give specific examples", "Show self-awareness"],
    difficulty: "Intermediate",
  },
  {
    id: "customer_service_1",
    category: "Customer Service",
    title: "Greeting a Customer",
    prompt: "Greet a customer who just entered the store",
    targetAnswer: "Good afternoon! Welcome to our store. How may I help you today? Please feel free to look around, and let me know if you need any assistance.",
    tips: ["Smile and be friendly", "Use polite language", "Offer help proactively"],
    difficulty: "Beginner",
  },
  {
    id: "customer_service_2",
    category: "Customer Service",
    title: "Handling a Complaint",
    prompt: "A customer is complaining about a defective product",
    targetAnswer: "I sincerely apologize for the inconvenience. I completely understand your frustration. Let me help you resolve this issue right away. We can offer you a replacement or a full refund. Which would you prefer?",
    tips: ["Stay calm and empathetic", "Apologize sincerely", "Offer a solution"],
    difficulty: "Advanced",
  },
  {
    id: "workplace_1",
    category: "Workplace English",
    title: "Asking for Help",
    prompt: "Ask your supervisor for help with a task you don't understand",
    targetAnswer: "Excuse me, could I ask for your guidance? I am working on the report you assigned, but I am not sure about the format you prefer. Could you please clarify the requirements? I want to make sure I do it correctly.",
    tips: ["Be polite and respectful", "Be specific about what you need", "Show initiative"],
    difficulty: "Intermediate",
  },
];

function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const words1 = normalize(text1).split(/\s+/).filter(Boolean);
  const words2 = normalize(text2).split(/\s+/).filter(Boolean);
  if (words1.length === 0) return 0;
  const set2 = new Set(words2);
  const matches = words1.filter((w) => set2.has(w)).length;
  const precision = matches / words1.length;
  const recall = words2.length > 0 ? matches / words2.length : 0;
  if (precision + recall === 0) return 0;
  return Math.round(((2 * precision * recall) / (precision + recall)) * 100);
}

function getFeedback(score: number) {
  if (score >= 85) return { message: "Excellent! Very accurate. Keep it up!", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950" };
  if (score >= 70) return { message: "Good job! Cover more key phrases for perfection.", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950" };
  if (score >= 50) return { message: "Fair attempt. Try to include more key phrases.", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950" };
  return { message: "Keep practicing! Focus on key phrases and speak clearly.", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950" };
}

// Detect iOS
function isIOS() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function SpeakingClient({ user }: SpeakingClientProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [showTarget, setShowTarget] = useState(false);
  const [browserSupport, setBrowserSupport] = useState<"full" | "partial" | "none">("full");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const recognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<any>(null);
  const isIOSDevice = useRef(false);
  // Use ref to avoid stale closure in recognition callbacks
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef("");

  const scenario = SCENARIOS[currentIdx];
  const categories = ["All", ...Array.from(new Set(SCENARIOS.map((s) => s.category)))];
  const filteredScenarios = categoryFilter === "All" ? SCENARIOS : SCENARIOS.filter((s) => s.category === categoryFilter);

  useEffect(() => {
    isIOSDevice.current = isIOS();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setBrowserSupport("none");
    } else if (isIOSDevice.current) {
      setBrowserSupport("partial"); // iOS Safari works but limited
    } else {
      setBrowserSupport("full");
    }
  }, []);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = !isIOSDevice.current; // iOS doesn't support interim
    recognition.continuous = !isIOSDevice.current; // iOS doesn't support continuous
    recognition.maxAlternatives = 1;
    return recognition;
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognition.onstart = () => {
      setIsRecording(true);
      isRecordingRef.current = true;
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interim += text;
        }
      }
      if (finalText) {
        const newTranscript = (transcriptRef.current + " " + finalText).trim();
        transcriptRef.current = newTranscript;
        setTranscript(newTranscript);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // iOS: restart only if still recording
        if (isIOSDevice.current && isRecordingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (isRecordingRef.current) startRecognition();
          }, 500);
        }
      } else if (event.error !== "aborted") {
        console.error("Speech error:", event.error);
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    recognition.onend = () => {
      setInterimText("");
      // iOS: auto-restart ONLY if still recording
      if (isIOSDevice.current && isRecordingRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current) startRecognition();
        }, 200);
      } else if (!isIOSDevice.current) {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Recognition start error:", e);
    }
  }, [createRecognition]);

  const startRecording = useCallback(() => {
    if (browserSupport === "none") {
      toast.error("Speech recognition not supported. Please use Safari on iPhone or Chrome on Android/Desktop.");
      return;
    }
    // Reset transcript ref
    transcriptRef.current = "";
    setTranscript("");
    setInterimText("");
    setScore(null);
    isRecordingRef.current = true;
    setIsRecording(true);
    startRecognition();
  }, [browserSupport, startRecognition]);

  const stopRecording = useCallback(() => {
    // Set ref first to prevent iOS restart
    isRecordingRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    setIsRecording(false);
    setInterimText("");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  const calculateScore = useCallback(() => {
    const fullText = (transcript + " " + interimText).trim();
    if (!fullText) { toast.error("Please record your answer first"); return; }
    stopRecording();
    const similarity = calculateSimilarity(fullText, scenario.targetAnswer);
    setScore(similarity);
    if (user.role === "student") {
      awardBadge(user.id, "interview_ready");
      if (similarity >= 75) awardPoints(user.id, 50, "speaking practice");
    }
  }, [transcript, interimText, scenario.targetAnswer, user, stopRecording]);

  const playTarget = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(scenario.targetAnswer);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error("Text-to-speech not supported on this device");
    }
  };

  const reset = () => {
    stopRecording();
    transcriptRef.current = "";
    setTranscript("");
    setInterimText("");
    setScore(null);
    setShowTarget(false);
  };

  const difficultyColor: Record<string, string> = {
    Beginner: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    Intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    Advanced: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const displayText = (transcript + " " + interimText).trim();

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-blue-600" />
          Speaking Practice
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Practice job interview & workplace English with AI scoring
        </p>
      </div>

      {/* Browser support warning */}
      {browserSupport === "none" && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 dark:text-red-300 text-sm font-semibold">Speech Recognition Not Available</p>
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                  Please use <strong>Safari on iPhone/iPad</strong> or <strong>Chrome on Android/Desktop</strong> for this feature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {browserSupport === "partial" && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 border-0 shadow-sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-yellow-700 dark:text-yellow-300 text-xs">
              📱 <strong>iPhone/iPad detected.</strong> Speech recognition works but may pause between sentences — this is normal. Keep speaking and it will continue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Category filter — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategoryFilter(cat); setCurrentIdx(0); reset(); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              categoryFilter === cat
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Scenario Card */}
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <Badge className={`${difficultyColor[scenario.difficulty]} border-0 text-xs`}>{scenario.difficulty}</Badge>
            <span className="text-blue-200 text-xs">{currentIdx + 1} / {filteredScenarios.length}</span>
          </div>
          <p className="text-blue-200 text-xs font-medium">{scenario.category}</p>
          <h2 className="text-lg font-bold mt-0.5">{scenario.title}</h2>
        </div>

        <CardContent className="pt-4 pb-4 space-y-4">
          {/* Prompt */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">SCENARIO</p>
            <p className="text-gray-900 dark:text-white font-medium text-sm">{scenario.prompt}</p>
          </div>

          {/* Tips */}
          <div className="space-y-1">
            {scenario.tips.map((tip, i) => (
              <p key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />{tip}
              </p>
            ))}
          </div>

          {/* Recording area */}
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-center space-y-4">
            {/* Big mic button — touch-friendly */}
            <div className="flex justify-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={browserSupport === "none"}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : "bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {isRecording
                  ? <MicOff className="w-10 h-10 text-white" />
                  : <Mic className="w-10 h-10 text-white" />
                }
              </button>
            </div>

            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {isRecording
                ? <span className="text-red-500 font-semibold">🔴 Recording... Tap to stop</span>
                : "Tap to start recording"}
            </p>

            {/* Live transcript */}
            {(displayText || isRecording) && (
              <div className="text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-xl min-h-[60px]">
                <p className="text-xs font-semibold text-gray-500 mb-1">YOUR ANSWER:</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {transcript}
                  {interimText && <span className="text-gray-400 italic"> {interimText}</span>}
                  {isRecording && !displayText && <span className="text-gray-400 animate-pulse">Listening...</span>}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons — full width on mobile */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={calculateScore}
              disabled={!displayText || isRecording}
              className="gap-1.5 rounded-xl col-span-1 text-sm"
              size="sm"
            >
              <Star className="w-4 h-4" />
              Score
            </Button>
            <Button onClick={playTarget} variant="outline" className="gap-1.5 rounded-xl text-sm" size="sm">
              <Volume2 className="w-4 h-4" />
              Listen
            </Button>
            <Button onClick={reset} variant="ghost" className="gap-1.5 rounded-xl text-sm" size="sm">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>

          {/* Score result */}
          {score !== null && (
            <div className={`p-4 rounded-2xl ${getFeedback(score).bg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-gray-900 dark:text-white text-sm">Pronunciation Score</p>
                <span className={`text-3xl font-bold ${getFeedback(score).color}`}>{score}</span>
              </div>
              <Progress value={score} className="h-2.5 rounded-full mb-2" />
              <p className={`text-sm font-medium ${getFeedback(score).color}`}>{getFeedback(score).message}</p>
              {score >= 75 && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">🎉 +50 XP earned!</p>
              )}
            </div>
          )}

          {/* Target answer toggle */}
          <button
            onClick={() => setShowTarget(!showTarget)}
            className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center py-1"
          >
            {showTarget ? "Hide" : "Show"} target answer
          </button>
          {showTarget && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-xs font-semibold text-gray-500 mb-1">TARGET ANSWER:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">{scenario.targetAnswer}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation — large touch targets */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => { setCurrentIdx(Math.max(0, currentIdx - 1)); reset(); }}
          disabled={currentIdx === 0}
          className="gap-2 rounded-xl flex-1 h-12"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </Button>
        <div className="flex gap-1.5 flex-shrink-0">
          {filteredScenarios.slice(0, 5).map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIdx(i); reset(); }}
              className={`rounded-full transition-all ${
                i === currentIdx ? "bg-blue-600 w-6 h-2.5" : "bg-gray-300 dark:bg-gray-600 w-2.5 h-2.5"
              }`}
            />
          ))}
        </div>
        <Button
          onClick={() => { setCurrentIdx(Math.min(filteredScenarios.length - 1, currentIdx + 1)); reset(); }}
          disabled={currentIdx === filteredScenarios.length - 1}
          className="gap-2 rounded-xl flex-1 h-12"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
