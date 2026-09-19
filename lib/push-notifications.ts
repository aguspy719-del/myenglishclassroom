/**
 * Push notification utilities — client side.
 * Handles permission, subscription, and sending via API routes.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/** Convert base64 VAPID key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/** Request notification permission from the user */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

/** Encode an ArrayBuffer key as base64. Returns null when the key is missing. */
function encodeKey(key: ArrayBuffer | null): string | null {
  if (!key) return null;
  const bytes = new Uint8Array(key);
  // Guard against zero-length keys — they produce empty strings that
  // corrupt the subscription row in the DB.
  if (bytes.length === 0) return null;
  let binary = "";
  // Chunked to avoid stack overflow from spreading large arrays
  for (let i = 0; i < bytes.length; i += 4096) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return btoa(binary);
}

/** Subscribe to push and save subscription to DB via API */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[Push] VAPID public key not set");
    return false;
  }

  try {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) return false;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Extract and validate keys — a subscription without valid p256dh/auth
    // keys is unusable, so discard it and resubscribe fresh.
    let p256dh = encodeKey(subscription.getKey("p256dh"));
    let auth = encodeKey(subscription.getKey("auth"));

    if (!p256dh || !auth) {
      // Stale/corrupt browser subscription — drop it and create a new one
      await subscription.unsubscribe();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      p256dh = encodeKey(subscription.getKey("p256dh"));
      auth = encodeKey(subscription.getKey("auth"));
    }

    if (!p256dh || !auth || !subscription.endpoint) {
      console.error("[Push] Subscription missing valid keys after resubscribe");
      return false;
    }

    // Save to DB
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("[Push] Subscribe error:", err);
    return false;
  }
}

/** Unsubscribe from push */
export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
  } catch (err) {
    console.error("[Push] Unsubscribe error:", err);
  }
}

/** Send push notification to users (called server-side via fetch to API route) */
export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!userIds.length) return;
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds, payload }),
    });
  } catch (err) {
    console.error("[Push] Send error:", err);
  }
}
