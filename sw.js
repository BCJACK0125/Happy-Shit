// Happy Shit service worker: network first, cache as offline fallback.
// Network-first keeps development edits visible immediately.
const CACHE = 'happyshit-v2';
const SHELL = ['index.html', 'HappyShit.html', 'assets/hs-core.js', 'assets/hs-base.css', 'assets/icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Map tiles and geocoding stay network-only; caching them would grow without bound.
  if (/tile|nominatim/.test(url.hostname)) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && (url.origin === location.origin || /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: url.origin === location.origin }))
  );
});
