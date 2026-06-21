const CACHE_NAME = 'markix-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass service worker for non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Bypass service worker for backend API requests
  if (url.pathname.startsWith('/api/') || url.port === '8000') {
    return;
  }

  // 3. For page navigation requests, serve the cached index.html (SPA fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((response) => {
        return response || fetch(event.request);
      }).catch(() => {
        return fetch(event.request);
      })
    );
    return;
  }

  // 4. For same-origin static assets, use cache-first, fallback to network
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

