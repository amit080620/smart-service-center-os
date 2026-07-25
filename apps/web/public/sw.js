// Minimal service worker — its only job is to exist and be "active" so
// the browser considers this installable as a PWA. Deliberately does no
// caching/offline logic (that's a separate, bigger feature) — this just
// satisfies the technical requirement most browsers have for showing an
// install prompt at all.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally not intercepting requests — pass everything straight
  // through to the network. No offline support yet.
});
