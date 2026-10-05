"use client";

/**
 * ImportQuestionsDialog — paste exam text copied from MS Word and turn it
 * into draft questions automatically (rule-based parser, no AI).
 *
 * The teacher always sees a live preview of what was recognized, including
 * warnings and anything that could not be parsed, before anything is added.
 */

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardPaste, CheckCircle, ChevronDown, ChevronUp, AlertTriangle, FileQuestion,
} from "lucide-react";
import { parseQuestions, type ParsedQuestion } from "@/lib/parse-questions";
import { cn } from "@/lib/utils";

const EXAMPLE_TEXT = `1. I ... to school every morning.
A. go
B. goes
C. going
D. gone

2. She ... a book last night.
A. read
B. reads
C. reading
D. was read

45. Write a paragraph about your holiday!

KUNCI JAWABAN:
1. B   2. A`;

const OPT_LETTERS = ["a", "b", "c", "d"] as const;

interface ImportQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (questions: ParsedQuestion[]) => void;
}

export function ImportQuestionsDialog({ open, onOpenChange, onAdd }: ImportQuestionsDialogProps) {
  const [text, setText] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);

  // Live parse — the parser is fast and pure, no debounce needed for exam-size text
  const result = useMemo(() => parseQuestions(text), [text]);
  const mcCount = result.questions.filter((q) => q.question_type === "multiple_choice").length;
  const essayCount = result.questions.length - mcCount;
  const hasLeftovers =
    result.skipped.length > 0 || result.unparsed.length > 0 || result.keyMisses.length > 0;

  const handleAdd = () => {
    if (result.questions.length === 0) return;
    onAdd(result.questions);
    setText("");
    setShowSkipped(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
            Import Questions from Word
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Format guide */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                📋 Format that works (tap to {showGuide ? "hide" : "show"})
              </span>
              {showGuide
                ? <ChevronUp className="w-4 h-4 text-blue-600" />
                : <ChevronDown className="w-4 h-4 text-blue-600" />}
            </button>
            {showGuide && (
              <div className="px-3 pb-3 space-y-1.5">
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                  <li>Start each question with a number: <code className="font-mono">1.</code> or <code className="font-mono">1)</code></li>
                  <li>Options on their own lines: <code className="font-mono">A. B. C. D.</code> (or all on one line)</li>
                  <li>Answer key: <code className="font-mono">Jawaban: B</code> after the options, or a <code className="font-mono">KUNCI JAWABAN:</code> list at the end (<code className="font-mono">1. B 2. A …</code>)</li>
                  <li>No options = essay question automatically</li>
                  <li>Copy straight from MS Word — spaces, tabs, and bullets are cleaned automatically</li>
                </ul>
                <button
                  type="button"
                  onClick={() => setText(EXAMPLE_TEXT)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Fill with example →
                </button>
              </div>
            )}
          </div>

          {/* Paste area */}
          <Textarea
            placeholder={"Paste your questions here…\n\n1. She ... a book last night.\nA. read\nB. reads\nC. reading\nD. was read\n\nJawaban: B"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="rounded-xl font-mono text-xs leading-relaxed"
          />

          {/* Live preview */}
          {text.trim().length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Detected: {result.questions.length} question{result.questions.length !== 1 ? "s" : ""}
                </p>
                {result.questions.length > 0 && (
                  <span className="text-xs text-gray-500">
                    ({mcCount} multiple choice · {essayCount} essay)
                  </span>
                )}
              </div>

              {result.questions.length === 0 ? (
                <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 text-sm text-orange-700 dark:text-orange-300">
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    No questions recognized yet. Check the format: questions need a number
                    (<code className="font-mono">1.</code>) and multiple choice needs options
                    (<code className="font-mono">A.</code>–<code className="font-mono">D.</code>).
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {result.questions.map((q, i) => (
                    <PreviewRow key={i} q={q} />
                  ))}
                </div>
              )}

              {/* Unrecognized parts — always visible, never silent */}
              {hasLeftovers && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowSkipped(!showSkipped)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                      {result.skipped.length + result.unparsed.length} line{result.skipped.length + result.unparsed.length !== 1 ? "s" : ""} not recognized
                      {result.keyMisses.length > 0 && ` · answer key mismatch on #${result.keyMisses.join(", #")}`}
                    </span>
                    {showSkipped
                      ? <ChevronUp className="w-4 h-4 text-gray-400" />
                      : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {showSkipped && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {result.unparsed.map((u, i) => (
                        <p key={`u${i}`} className="text-xs text-orange-600 dark:text-orange-400">
                          <b>Not parsed:</b> {u.text}
                        </p>
                      ))}
                      {result.skipped.map((s, i) => (
                        <p key={`s${i}`} className="text-xs text-gray-400 truncate">— {s}</p>
                      ))}
                      {result.keyMisses.map((n) => (
                        <p key={`k${n}`} className="text-xs text-orange-600 dark:text-orange-400">
                          Answer key found for #{n} but no matching question (numbering mismatch?)
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleAdd}
            disabled={result.questions.length === 0}
            className="gap-1 rounded-xl"
          >
            <CheckCircle className="w-4 h-4" />
            Add {result.questions.length || ""} Question{result.questions.length !== 1 ? "s" : ""} to Drafts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewRow({ q }: { q: ParsedQuestion }) {
  const isEssay = q.question_type === "essay";
  const optionsText = OPT_LETTERS
    .filter((k) => q.options[k]?.trim())
    .map((k) => `${k.toUpperCase()}. ${q.options[k]}`)
    .join("  ·  ");

  return (
    <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-xs font-bold text-emerald-600">{q.number ?? "–"}.</span>
        <Badge
          className={cn(
            "text-[10px]",
            isEssay
              ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          )}
        >
          {isEssay ? "✍️ Essay" : "📝 Multiple Choice"}
        </Badge>
        {!isEssay && (
          <Badge variant="outline" className="text-[10px]">
            {q.correct_answer
              ? <span className="text-green-700 dark:text-green-400 font-semibold">Key: {q.correct_answer.toUpperCase()}</span>
              : <span className="text-orange-600">no key</span>}
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-900 dark:text-white line-clamp-2 whitespace-pre-wrap">{q.question}</p>
      {!isEssay && optionsText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{optionsText}</p>
      )}
      {q.warnings.map((w, i) => (
        <p key={i} className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{w}
        </p>
      ))}
    </div>
  );
}
