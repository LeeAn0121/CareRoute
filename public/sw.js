const CACHE_NAME = 'careroute-store-v4';

self.addEventListener('install', () => {});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  if (request.method !== 'GET') {
    return;
  }

  // 데이터베이스 API 및 외부 API 요청은 절대 캐시하지 않음 (네트워크 직행)
  if (
    request.url.includes('supabase.co') ||
    request.url.includes('api.open-meteo.com') ||
    request.url.includes('apihub.kma.go.kr') ||
    request.url.includes('api.allorigins.win') ||
    request.url.includes('openapi.map.naver.com')
  ) {
    e.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(
        () => caches.match(request)
          .then((cached) => cached || caches.match('/CareRoute/')),
      ),
    );
    return;
  }

  // Network First for HTML, Cache First for Static Assets
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.url.startsWith('http')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: '케어루트 알림', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || '케어루트 알림 🚨', {
      body: payload.body || '',
      icon: '/CareRoute/icon-192.png',
      badge: '/CareRoute/icon-192.png',
      data: { url: payload.url || '/CareRoute/', recipientId: payload.recipientId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data?.type === 'update') {
    event.waitUntil(
      (async () => {
        if (self.registration.waiting) {
          self.registration.waiting.postMessage('SKIP_WAITING');
        }
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windowClients.length > 0) return windowClients[0].focus();
        return clients.openWindow('/CareRoute/');
      })(),
    );
    return;
  }

  const url = event.notification.data?.url || '/CareRoute/';
  const recipientId = event.notification.data?.recipientId;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes('/CareRoute/'));
      if (existing) {
        if (recipientId) existing.postMessage({ type: 'FOCUS_RECIPIENT', id: recipientId });
        return existing.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
