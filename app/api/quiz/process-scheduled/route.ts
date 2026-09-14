import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@englishlms.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * GET /api/quiz/process-scheduled
 * Publishes quizzes whose published_at has arrived and sends their push
 * notifications (queued in push_sent at schedule time). Designed to be hit
 * by a cron (Supabase pg_cron / GitHub Actions / Vercel Cron), but every step
 * is idempotent so it is safe to call repeatedly.
 *
 * Optional header: x-cron-secret must equal CRON_SECRET when that env var is set.
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.get("x-cron-secret") !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const nowIso = new Date().toISOString();

    // 1. Publish quizzes whose schedule time has arrived
    const { data: due, error } = await supabase
      .from("quizzes")
      .update({ is_published: true })
      .lte("published_at", nowIso)
      .eq("is_published", false)
      .select("id, title, class_id");
    if (error) {
      console.error("[ProcessScheduled] publish failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let pushesSent = 0;

    // 2. Send queued pushes for all published quizzes (covers both new and
    //    previously-failed sends — statuses make it idempotent)
    if (due && due.length > 0) {
      const { data: pending } = await supabase
        .from("push_sent")
        .select("id, quiz_id, user_id")
        .in("quiz_id", due.map((q) => q.id))
        .eq("status", "pending");

      for (const row of pending || []) {
        const quiz = due.find((q) => q.id === row.quiz_id);
        if (!quiz) continue;
        try {
          await sendPushForQuiz(supabase, row.user_id, quiz.title);
          await supabase.from("push_sent").update({ status: "sent" }).eq("id", row.id);
          pushesSent++;
        } catch (e: any) {
          // 410 Gone = subscription expired; delete and mark failed
          if (e?.statusCode === 410 || e?.statusCode === 404) {
            await supabase.from("push_sent").update({ status: "failed" }).eq("id", row.id);
            await supabase.from("push_subscriptions").delete().eq("user_id", row.user_id);
          } else {
            console.warn("[ProcessScheduled] push failed for user:", row.user_id, e?.message);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, published: due?.length || 0, pushesSent });
  } catch (err: any) {
    console.error("[ProcessScheduled] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendPushForQuiz(supabase: any, userId: string, quizTitle: string) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: "📝 Assessment Open",
    body: `${quizTitle} is now available. Good luck!`,
    url: "/quiz",
    icon: "/icons/icon-192x192.png",
  });

  await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );
}
