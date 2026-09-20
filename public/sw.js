const CACHE_NAME = 'careroute-store-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
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

  // 데이터베이스 API (Supabase) 요청은 절대 캐시하지 않음 (네트워크 직행)
  if (request.url.includes('supabase.co')) {
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

// 서버(Edge Function)에서 보낸 Web Push를 받아 실제 OS 알림으로 표시.
// 앱이 닫혀있거나 백그라운드여도 브라우저가 이 이벤트를 깨워서 실행해준다.
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
      data: { url: payload.url || '/CareRoute/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/CareRoute/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes('/CareRoute/'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    }),
  );
});
