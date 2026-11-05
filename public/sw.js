/* Liftlog service worker: shows lock-screen alerts sent by the server. It caches nothing. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Liftlog", {
      body: d.body || "",
      tag: d.tag || "liftlog",
      renotify: true,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      vibrate: [220, 120, 220, 120, 220],
      timestamp: d.ts || Date.now(),
      data: { url: "/#train" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) if ("focus" in w) return w.focus();
      return self.clients.openWindow(event.notification.data?.url || "/");
    })()
  );
});
