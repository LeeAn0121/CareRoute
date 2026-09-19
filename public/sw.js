self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('careroute-store').then((cache) => cache.addAll([
      '/CareRoute/',
      '/CareRoute/index.html',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
