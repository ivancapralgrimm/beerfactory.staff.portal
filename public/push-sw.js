/* BFStaff Web Push handler imported by the Workbox-generated service worker. */
async function clearAppBadge() {
  try {
    if (self.navigator && "clearAppBadge" in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // Badging is optional and must never block notifications.
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "BeerFactory · Новая передача",
      body: "В Handover появилась новая заметка.",
      url: "/#/handover"
    };
  }

  const title = payload.title || "BeerFactory · Новая передача";
  const options = {
    body: payload.body || "Откройте передачу смены.",
    icon: payload.icon || "/assets/icons/icon-192.png",
    badge: payload.badge || "/assets/icons/icon-192.png",
    tag: payload.tag || "bfstaff-handover",
    data: { url: payload.url || "/#/handover" },
    renotify: true,
    silent: false,
    vibrate: [160, 80, 180]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relative = event.notification?.data?.url || "/#/handover";
  const targetUrl = new URL(relative, self.location.origin).href;

  event.waitUntil((async () => {
    await clearAppBadge();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        if ("navigate" in client) await client.navigate(targetUrl);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(clearAppBadge());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "BF_CLEAR_APP_BADGE") {
    event.waitUntil(clearAppBadge());
  }
});
