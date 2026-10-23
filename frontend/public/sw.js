self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Background push: runs even when no application tab is open.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const raw = data.url || "/notifications";
  let url; try { url = new URL(raw, self.location.origin); } catch { url = new URL('/notifications', self.location.origin); }
  if (url.pathname === '/app' || url.pathname.startsWith('/app/')) url.pathname = url.pathname.slice(4) || '/dashboard';
  const target = url.origin === self.location.origin ? url.href : self.location.origin + "/notifications";
  event.waitUntil(self.registration.showNotification(data.title || "New update", {
    body: data.body || "Open ComplianceCore to see your update.", data: { url: target }, icon: '/push-icon-192.png', badge: '/push-icon-192.png',
    tag: data.tag || undefined, renotify: !!data.tag, silent: false, vibrate: [200, 100, 200],
  }).then(async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: "orion-push" }));
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (url.origin !== self.location.origin) return;
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) if (new URL(c.url).origin === self.location.origin && "focus" in c) {
      await c.navigate(url.href); await c.focus(); return;
    }
    await self.clients.openWindow(url.href);
  })());
});
