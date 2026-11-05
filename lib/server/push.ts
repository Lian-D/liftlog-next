import "server-only";
import webpush, { WebPushError } from "web-push";
import { db } from "./db";

/**
 * Lock-screen alerts through Web Push.
 *
 * A browser that turns alerts on gives us a subscription: an https endpoint at its
 * push service (Google, Apple, Mozilla or Microsoft) plus keys to encrypt for it.
 * When a rest timer starts, the page records its end time here; a loop in the
 * server process sends the push at that moment, so it arrives even when the phone
 * is locked and the page is frozen. The page also reports whether it's on screen,
 * and the push is skipped when it is, so the alert doesn't sound twice.
 */

/** Push services we'll send to. Anything else is refused, so the server can't be pointed at arbitrary URLs. */
const PUSH_HOSTS = (process.env.PUSH_HOST_ALLOWLIST?.trim() || "googleapis.com,push.apple.com,push.services.mozilla.com,notify.windows.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function pushHostAllowed(endpoint: string) {
  try {
    const u = new URL(endpoint);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

const setting = (key: string) => (db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
const putSetting = (key: string, value: string, overwrite = false) =>
  db()
    .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO ${overwrite ? "UPDATE SET value = excluded.value" : "NOTHING"}`)
    .run(key, value);

/** The server's VAPID key pair, made on first use and kept in the database so subscriptions survive restarts. */
export function vapidKeys() {
  let pub = setting("vapidPublic");
  let priv = setting("vapidPrivate");
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    db().transaction(() => {
      putSetting("vapidPublic", k.publicKey);
      putSetting("vapidPrivate", k.privateKey);
    })();
    pub = setting("vapidPublic")!;
    priv = setting("vapidPrivate")!;
  }
  return { publicKey: pub, privateKey: priv };
}

/**
 * Who the pushes come from. Push services want a mailto: or https: contact; Apple
 * rejects localhost. PUSH_SUBJECT wins, else the site's own address as last seen
 * over HTTPS (e.g. https://liftlog.example.com).
 */
const subject = () => process.env.PUSH_SUBJECT?.trim() || setting("pushSubject") || "mailto:liftlog@example.com";

export function rememberSiteAddress(origin: string | null) {
  if (origin && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)) putSetting("pushSubject", origin, true);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };

export function saveSubscription(uid: string, sub: PushSub, userAgent: string) {
  db()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`
    )
    .run(sub.endpoint, uid, sub.p256dh, sub.auth, userAgent.slice(0, 200), Date.now());
}

export function removeSubscription(uid: string, endpoint: string) {
  return db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").run(endpoint, uid).changes > 0;
}

export function ownsSubscription(uid: string, endpoint: string) {
  return !!db().prepare("SELECT 1 FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").get(endpoint, uid);
}

/**
 * Record this browser's timer: its end time (null when paused, reset or finished)
 * and whether the app is on screen. Only applied if seq is newer than what's stored.
 */
export function setAlarm(endpoint: string, a: { endAt: number | null; title: string; label: string; hidden: boolean; seq: number }) {
  db()
    .prepare(
      `INSERT INTO timer_alarms (endpoint, end_at, title, label, hidden, seq) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET end_at = excluded.end_at, title = excluded.title, label = excluded.label,
         hidden = excluded.hidden, seq = excluded.seq
       WHERE excluded.seq > timer_alarms.seq`
    )
    .run(endpoint, a.endAt ?? 0, a.title, a.label, a.hidden ? 1 : 0, a.seq);
}

export async function sendPush(sub: PushSub, payload: { title: string; body: string; tag: string }) {
  const keys = vapidKeys();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ ...payload, ts: Date.now() }),
      {
        vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
        // A rest alarm that turns up minutes late is worse than none.
        TTL: 90,
        urgency: "high",
        topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
        timeout: 10_000,
      }
    );
    return { ok: true as const };
  } catch (err) {
    const status = err instanceof WebPushError ? err.statusCode : 0;
    // 404/410: the browser dropped this subscription (alerts turned off, app removed). Forget it.
    if (status === 404 || status === 410) db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
    const detail = err instanceof WebPushError ? `${err.statusCode} ${err.body || err.message}` : String(err);
    return { ok: false as const, status, detail: detail.slice(0, 300) };
  }
}

type DueRow = { endpoint: string; end_at: number; title: string; label: string; hidden: number; p256dh: string; auth: string };

/** Send every alarm that's due. Alarms whose page was on screen are just cleared; the page sounded them itself. */
export async function runDueAlarms(now = Date.now()) {
  const due = db()
    .prepare(
      `SELECT a.endpoint, a.end_at, a.title, a.label, a.hidden, s.p256dh, s.auth
       FROM timer_alarms a JOIN push_subscriptions s ON s.endpoint = a.endpoint WHERE a.end_at > 0 AND a.end_at <= ?`
    )
    .all(now) as DueRow[];
  if (!due.length) return;
  const clear = db().prepare("UPDATE timer_alarms SET end_at = 0 WHERE endpoint = ? AND end_at = ?");
  for (const a of due) clear.run(a.endpoint, a.end_at);
  await Promise.all(
    due
      .filter((a) => a.hidden && now - a.end_at < 60_000)
      .map(async (a) => {
        const r = await sendPush(a, { title: a.title || "Time's up", body: a.label || "Your timer has finished.", tag: "liftlog-timer" });
        if (!r.ok) console.warn(`[push] couldn't deliver a rest alert (${r.detail})`);
      })
  );
}

const g = globalThis as unknown as { __liftlogAlarmLoop?: NodeJS.Timeout };

/** Check for due alarms twice a second. Started once per server process from instrumentation.ts. */
export function startAlarmLoop() {
  if (g.__liftlogAlarmLoop) return;
  let running = false;
  g.__liftlogAlarmLoop = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runDueAlarms();
    } catch (err) {
      console.error("[push] alarm loop", err);
    } finally {
      running = false;
    }
  }, 500);
  g.__liftlogAlarmLoop.unref?.();
}
