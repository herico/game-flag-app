/* Flag Game PWA Service Worker */
// Bump this when caching logic or core assets change to ensure fresh caches
const CACHE_NAME = 'flag-game-cache-v12';

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

// Allow clients to trigger immediate activation of a waiting SW
self.addEventListener('message', (event) => {
  try {
    const data = event.data || {};
    if (data && data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch {}
});

// Cache-first for same-origin assets and images; network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isImage = request.destination === 'image' || /\.(png|svg|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url.pathname);
  const isHtmlNavigation = request.mode === 'navigate' || (request.destination === 'document');
  const isStaticAsset = /\.(?:js|css)(\?.*)?$/i.test(url.pathname);
  const isJson = /\.(?:json)(\?.*)?$/i.test(url.pathname);

  // Strategy:
  // - HTML navigations: network-first (ensures new app shell), fallback to cache
  // - Same-origin JS/CSS: stale-while-revalidate (serve fast, update in bg)
  // - JSON (same-origin): network-first to respect freshness controls
  // - Images (any origin): cache-first, then network; cache opaque too
  // - Other cross-origin: network-first with cache fallback

  // HTML: network-first keeps app shell up to date
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update cache copy for offline
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {})
          );
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

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
    // JSON: prefer network to reflect latest content
    if (isJson) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            try {
              if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
              }
            } catch {}
            return response;
          })
          .catch(() => caches.match(request))
      );
      return;
    }

    // JS/CSS: stale-while-revalidate
    if (isStaticAsset) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              try {
                if (response.ok) {
                  const copy = response.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
                }
              } catch {}
              return response;
            })
            .catch(() => cached);
          // Return cached immediately if present, else wait for network
          return cached || fetchPromise;
        })
      );
      return;
    }

    // Default same-origin: cache-first with network fill
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
          .catch(() => new Response(''));
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
