const CACHE_NAME = 'careroute-store-v2';

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

  // Always go to the network for navigations (the HTML shell) so a new
  // deploy's fresh chunk references are used instead of a stale cached shell.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
    return;
  }

  // Static assets (Next.js content-hashed chunks, images, etc.) are safe to
  // cache-first since a new build ships new filenames.
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only http(s) requests are cacheable; requests injected by browser
        // extensions (chrome-extension://, etc.) must be skipped.
        if (response.ok && request.url.startsWith('http')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
