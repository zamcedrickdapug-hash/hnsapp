self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('hns-app-shell-v1').then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.webmanifest', '/logo.png', '/favicon.svg'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('/index.html'))
    )
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'H&S Booking System';
  const body = payload.body || 'You have a new notification.';

  const options = {
    body,
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = event.notification?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetPath);
          }
          return;
        }
      }

      return clients.openWindow(targetPath);
    })
  );
});
