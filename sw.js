/* lontar — service worker */
const V = 'lontar-v1';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isExternal = url.hostname !== location.hostname;
  if (isExternal) {
    // Network-only for Gutenberg, translate, proxies
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  // Cache-first for shell
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request))
  );
});
