import { api } from "./api";

/**
 * Lock-screen alerts (Web Push) in the browser.
 *
 * on / off        — supported here; alerts are or aren't turned on for this browser
 * insecure        — the page isn't on HTTPS, which push needs
 * ios-install     — iPhone/iPad Safari: only apps added to the Home Screen get push
 * unsupported     — this browser has no Web Push
 * denied          — notifications are blocked for this site
 */
export type PushState = "on" | "off" | "insecure" | "ios-install" | "unsupported" | "denied";

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Registers the small service worker that shows pushed alerts. Safe to call repeatedly. */
export async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function pushSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const reg = await swRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!window.isSecureContext) return "insecure";
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && (await pushSubscription()) ? "on" : "off";
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

const sameKey = (sub: PushSubscription, key: Uint8Array) => {
  const k = sub.options.applicationServerKey;
  if (!k) return false;
  const a = new Uint8Array(k);
  return a.length === key.length && a.every((v, i) => v === key[i]);
};

/** Turn alerts on. Call straight from a tap: iOS only shows the permission prompt for a direct gesture. */
export async function enablePush(): Promise<string> {
  const perm = await Notification.requestPermission();
  if (perm === "denied") throw new Error("Notifications are blocked for this site. Allow them in the browser's settings for this site, then try again.");
  if (perm !== "granted") throw new Error("Notifications weren't allowed, so alerts stay off.");
  const reg = await swRegistration();
  if (!reg) throw new Error("This browser couldn't start Liftlog's alert helper.");
  await navigator.serviceWorker.ready;
  const key = b64ToBytes((await api.push.key()).publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.push.subscribe(sub.toJSON());
  return sub.endpoint;
}

export async function disablePush() {
  const sub = await pushSubscription();
  if (!sub) return;
  await api.push.unsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Clear alerts already sitting in the notification tray, e.g. once the app is open again. */
export async function clearShownAlerts() {
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  const shown = await reg?.getNotifications?.({ tag: "liftlog-timer" }).catch(() => []);
  shown?.forEach((n) => n.close());
}
