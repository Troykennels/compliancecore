import webpush from "web-push";

export type DeviceSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export function validSubscription(value: unknown): value is DeviceSubscription {
  if (!value || typeof value !== "object") return false;
  const s = value as DeviceSubscription;
  try {
    const u = new URL(s.endpoint);
    const allowed =
      [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].some((h) => u.hostname === h) ||
      [
        ".push.services.mozilla.com",
        ".push.apple.com",
        ".notify.windows.com",
      ].some((h) => u.hostname.endsWith(h));
    return (
      allowed &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      s.endpoint.length <= 2048 &&
      /^[A-Za-z0-9_-]{86,88}={0,2}$/.test(s.keys?.p256dh || "") &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys?.auth || "")
    );
  } catch {
    return false;
  }
}
export function safePushPath(
  value: string | null | undefined,
  fallback = "/notifications",
) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}
export async function deliverPush(
  subscription: DeviceSubscription,
  payload: { title: string; body?: string; url?: string; tag?: string },
  keys: { publicKey: string; privateKey: string },
) {
  if (!validSubscription(subscription))
    throw new Error("Invalid browser push subscription");
  return webpush.sendNotification(
    subscription,
    JSON.stringify({ ...payload, url: safePushPath(payload.url) }),
    {
      vapidDetails: {
        subject:
          process.env.VAPID_SUBJECT || "mailto:orionsoftlimited@gmail.com",
        ...keys,
      },
      TTL: 86400,
      urgency: "high",
      timeout: 10000,
    },
  );
}
export const generatePushKeys = () => webpush.generateVAPIDKeys();
