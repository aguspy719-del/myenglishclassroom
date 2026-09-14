"use client";

import { useState } from "react";
import { Send, CalendarClock, EyeOff, Loader2, Clock, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Quiz } from "@/types";

interface QuizSendPanelProps {
  quiz: Quiz;
  questionCount: number;
  attemptCount: number;
}

// toLocalInput: ISO → "YYYY-MM-DDTHH:mm" in the browser's timezone
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function QuizSendPanel({ quiz, questionCount, attemptCount }: QuizSendPanelProps) {
  // Local mirror so status badges react instantly without a page reload
  const [state, setState] = useState({
    is_published: quiz.is_published !== false,
    published_at: quiz.published_at || "",
    available_until: quiz.available_until || "",
  });
  const [saving, setSaving] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(toLocalInput(quiz.available_until));

  const publishedAt = state.published_at ? new Date(state.published_at) : null;
  const isScheduled = !state.is_published && !!publishedAt && publishedAt > new Date();
  const isDraft = !state.is_published && (!publishedAt || publishedAt <= new Date());
  const isSent = state.is_published && (!publishedAt || publishedAt <= new Date());
  const isClosed = !!state.available_until && new Date(state.available_until) <= new Date();

  const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

  const handleSendNow = async () => {
    if (questionCount === 0) {
      toast.error("Add questions first before sending to students");
      return;
    }
    if (attemptCount > 0 && !confirm("Students already submitted. Change access anyway?")) return;
    setSaving(true);
    const iso = new Date().toISOString();
    const { error } = await createClient()
      .from("quizzes")
      .update({ is_published: true, published_at: iso })
      .eq("id", quiz.id);
    setSaving(false);
    if (error) { toast.error("Failed to send"); return; }
    setState((s) => ({ ...s, is_published: true, published_at: iso }));
    toast.success("Assessment sent! Students can access it now.");
    void notifyStudents(quiz.id);
  };

  const handleSchedule = async () => {
    if (!publishedAt) { toast.error("Pick a date and time first"); return; }
    setSaving(true);
    const iso = publishedAt.toISOString();
    const { error } = await createClient()
      .from("quizzes")
      .update({ is_published: false, published_at: iso })
      .eq("id", quiz.id);
    setSaving(false);
    if (error) { toast.error("Failed to schedule"); return; }
    setState((s) => ({ ...s, is_published: false, published_at: iso }));
    toast.success(`Scheduled: students get access on ${publishedAt.toLocaleString()}`);
    void queuePushes(quiz.id, iso);
  };

  const handleUnpublish = async () => {
    if (attemptCount > 0 && !confirm("Students already submitted. Close access anyway?")) return;
    if (!confirm("Close access now? Students will no longer be able to open this assessment.")) return;
    setSaving(true);
    const { error } = await createClient()
      .from("quizzes")
      .update({ is_published: false })
      .eq("id", quiz.id);
    setSaving(false);
    if (error) { toast.error("Failed to close access"); return; }
    setState((s) => ({ ...s, is_published: false }));
    toast.success("Access closed for students");
  };

  const handleSetDeadline = async (value: string) => {
    setSaving(true);
    const { error } = await createClient()
      .from("quizzes")
      .update({ available_until: toIso(value) })
      .eq("id", quiz.id);
    setSaving(false);
    if (error) { toast.error("Failed to set deadline"); return; }
    setState((s) => ({ ...s, available_until: toIso(value) || "" }));
    setDeadlineInput(value);
    toast.success(value ? "Access deadline saved" : "Access deadline removed");
  };

  const notifyStudents = async (quizId: string) => {
    try {
      const supabase = createClient();
      const { data: q } = await supabase.from("quizzes").select("title, class_id").eq("id", quizId).single();
      if (!q) return;
      const { data: students } = await supabase.from("users").select("id").eq("class_id", q.class_id).eq("role", "student");
      if (!students?.length) return;
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: students.map((s) => s.id),
          payload: { title: "📝 Assessment Open", body: q.title, url: "/quiz" },
        }),
      });
    } catch { /* non-blocking */ }
  };

  const queuePushes = async (quizId: string, scheduledAt: string) => {
    try {
      const supabase = createClient();
      const { data: q } = await supabase.from("quizzes").select("class_id").eq("id", quizId).single();
      if (!q) return;
      const { data: students } = await supabase.from("users").select("id").eq("class_id", q.class_id).eq("role", "student");
      if (!students?.length) return;
      await supabase.from("push_sent").insert(
        students.map((s) => ({ quiz_id: quizId, user_id: s.id, status: "pending", scheduled_at: scheduledAt }))
      );
    } catch { /* non-blocking */ }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-600" /> Send & Access Control
          </p>
          {isSent && !isClosed && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Sent — students can access
            </Badge>
          )}
          {isScheduled && (
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 gap-1">
              <CalendarClock className="w-3 h-3" /> Scheduled {publishedAt?.toLocaleString()}
            </Badge>
          )}
          {isDraft && (
            <Badge variant="secondary" className="gap-1">
              <EyeOff className="w-3 h-3" /> Draft — not visible to students
            </Badge>
          )}
          {isClosed && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 gap-1">
              <XCircle className="w-3 h-3" /> Closed
            </Badge>
          )}
        </div>

        {questionCount === 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              No questions yet. Add questions in the Questions tab before sending to students.
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Button onClick={handleSendNow} disabled={saving || (isSent && !isClosed)} className="gap-2 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSent && !isClosed ? "Already Sent" : isClosed ? "Reopen & Send Now" : "Send Now"}
          </Button>
          <Button onClick={handleUnpublish} disabled={saving || !state.is_published} variant="outline" className="gap-2 rounded-xl">
            <EyeOff className="w-4 h-4" /> Close Access
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Or schedule sending (students get access at this time)</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="datetime-local"
              value={toLocalInput(state.published_at)}
              onChange={(e) =>
                setState((s) => ({ ...s, published_at: e.target.value ? new Date(e.target.value).toISOString() : "" }))
              }
              className="rounded-xl flex-1"
            />
            <Button onClick={handleSchedule} disabled={saving || !publishedAt} variant="outline" className="gap-2 rounded-xl">
              <CalendarClock className="w-4 h-4" /> Schedule
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isScheduled
              ? `⏰ Students get access on ${publishedAt?.toLocaleString()}`
              : "Leave empty = students can access whenever this is sent"}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" /> Access deadline (optional — closes automatically)
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="rounded-xl flex-1"
            />
            <Button onClick={() => handleSetDeadline(deadlineInput)} disabled={saving} variant="outline" className="gap-2 rounded-xl">
              Save Deadline
            </Button>
            {state.available_until && (
              <Button
                variant="ghost"
                size="icon"
                title="Remove deadline"
                className="rounded-xl text-red-500"
                onClick={() => handleSetDeadline("")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
          {state.available_until && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              🔒 Closes automatically on {new Date(state.available_until).toLocaleString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
