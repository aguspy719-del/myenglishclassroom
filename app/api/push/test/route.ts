import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@englishlms.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * POST /api/push/test — send a test push to the CURRENT user's devices.
 * Diagnostics: tells the client whether VAPID keys are configured,
 * whether this device has a saved subscription, and whether the push
 * service accepted the message.
 */
export async function POST() {
  const checks: Record<string, string> = {};

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    checks.vapid = "MISSING — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars";
    return NextResponse.json({ ok: false, checks, error: "VAPID keys not configured" }, { status: 500 });
  }
  checks.vapid = "ok";

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user.id);
    checks.subscriptions = String(subs?.length || 0);
    const corrupt = subs?.filter((s) => !s.p256dh || !s.auth).length || 0;
    if (corrupt > 0) checks.corrupt = `${corrupt} row(s) missing keys — auto-fixed`;

    if (!subs?.length) {
      return NextResponse.json(
        { ok: false, checks, error: "No subscription saved for this account on any device. Enable notifications first." },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: "🔔 Test Notification",
      body: "Push berkerja! Notifikasi ini muncul meski aplikasi tertutup.",
      url: "/dashboard",
      icon: "/icons/icon-192.png",
    });

    let sent = 0;
    const failed: string[] = [];
    await Promise.allSettled(
      subs.map(async (sub) => {
        // Rows without valid keys can never receive pushes — delete them
        // instead of failing the test.
        if (!sub.p256dh || !sub.auth) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          failed.push("corrupt-row (deleted)");
          return;
        }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          // 410 Gone = subscription expired, clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          failed.push(`${err.statusCode || "ERR"}: ${err.message?.slice(0, 120)}`);
        }
      })
    );

    if (sent === 0) {
      return NextResponse.json({ ok: false, checks, error: `Push failed: ${failed.join(" | ")}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, checks, sent });
  } catch (err: any) {
    return NextResponse.json({ ok: false, checks, error: err.message }, { status: 500 });
  }
}
