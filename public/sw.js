// AWAKEN service worker: shows the evening reminder and opens the app when it's tapped.
// It doesn't cache anything, so the app always loads fresh.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "AWAKEN", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: "awaken-reminder",
      data: { url: data.url || "/system" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/system", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => w && w.focus());
      return self.clients.openWindow(url);
    }),
  );
});
