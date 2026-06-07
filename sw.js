const CACHE = 'krok-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/questions.json',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap',
  'https://cdn.ably.com/lib/ably.min-2.js'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache local assets first (critical)
      return cache.addAll(['/', '/index.html', '/questions.json', '/manifest.json'])
        .then(() => {
          // Try to cache external assets (non-critical, ignore failures)
          return Promise.allSettled(
            ASSETS.slice(4).map(url => cache.add(url).catch(() => {}))
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local, network-first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for API calls
  if (url.hostname.includes('anthropic') || url.hostname.includes('workers.dev') || url.hostname.includes('ably')) {
    return; // Use network directly
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // Cache successful GET responses
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
