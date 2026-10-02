// Minimal service worker: makes the app installable on Android/Chrome.
// It deliberately caches NOTHING — every request goes to the network, so a
// new deploy is picked up on the next load and nobody gets stuck on an old
// version. (The app needs Supabase anyway, so offline mode wouldn't help.)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// A fetch handler is part of Chrome's installability check; pass everything through.
self.addEventListener('fetch', () => {});
