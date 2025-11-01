/* Flag Quiz PWA Service Worker */
const CACHE_NAME = 'flag-quiz-cache-v11';

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin assets and images; network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isImage = request.destination === 'image' || /\.(png|svg|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url.pathname);

  // Strategy:
  // - For images (any origin): cache-first, then network; cache opaque too
  // - For same-origin: cache-first
  // - For others: network-first with cache fallback

  if (isImage) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Cache successful or opaque image responses
            try {
              if (response.ok || response.type === 'opaque') {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
              }
            } catch {}
            return response;
          })
          .catch(() => caches.match('./assets/icons/icon-192.svg'));
      })
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            try {
              if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
              }
            } catch {}
            return response;
          })
          .catch(() => {
            if (request.mode === 'navigate') return caches.match('./index.html');
            return new Response('');
          });
      })
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        try {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
        } catch {}
        return response;
      })
      .catch(() => caches.match(request))
  );
});
