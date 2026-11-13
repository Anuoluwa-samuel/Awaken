import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";
import type { PushSender } from "./services/push";

export const pushConfigured = () => !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;

/** Sends one push. Returns false when the browser has unsubscribed, so the subscription can go. */
export const sendPush: PushSender = async (sub, payload) => {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 3,
        vapidDetails: { subject: siteUrl.origin, publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY! },
      },
    );
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    console.error("[reminders] push failed", status);
    return true;
  }
};
