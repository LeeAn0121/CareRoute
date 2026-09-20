const CACHE_NAME = 'careroute-store-v3';

// 예전엔 install 시점에 무조건 skipWaiting()을 호출해서 새 배포가 감지되는
// 즉시(사용자 동의 없이) 조용히 페이지를 강제 새로고침시켰다. 이제는 새
// 버전을 'waiting' 상태로 대기시켜두고, 클라이언트가 사용자 확인을 받은
// 뒤 SKIP_WAITING 메시지를 보낼 때만 활성화한다.
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
      data: { url: payload.url || '/CareRoute/', recipientId: payload.recipientId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // '업데이트 가능' 알림을 눌렀을 때: 대기 중인 새 버전을 바로 활성화시킨다.
  // (활성화되면 activate 핸들러가 옛 캐시를 지우고, 클라이언트의
  // controllerchange 리스너가 자동으로 새로고침한다.)
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
      // 이미 앱이 열려있으면 새로고침 없이 메시지로 바로 해당 어르신에게 포커싱시킨다.
      if (existing) {
        if (recipientId) existing.postMessage({ type: 'FOCUS_RECIPIENT', id: recipientId });
        return existing.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
