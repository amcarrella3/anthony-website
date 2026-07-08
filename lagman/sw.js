// sw.js — offline app shell, versioned ATOMICALLY. The whole shell is fetched
// fresh (bypassing the HTTP/CDN cache) at install, so the cache can never hold
// a mix of old and new modules — the exact failure that bricks an ES-module
// app. Pages are served ONLY from the versioned cache; nothing is added to it
// at runtime. Data lives in IndexedDB, not here.
//
// NOTE: deploy.sh stamps CACHE with a fresh version on every publish.

const CACHE = 'lagman-log-20260708164227';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/fonts/Fraunces.woff2',
  './js/app.js',
  './js/schema.js',
  './js/store.js',
  './js/util.js',
  './js/notation.js',
  './js/naming.js',
  './js/charts.js',
  './js/motion.js',
  './js/panel.js',
  './js/formatters.js',
  './js/places.js',
  './js/sample.js',
  './data/restaurants.js',
  './js/views/archive.js',
  './js/views/form.js',
  './js/views/detail.js',
  './js/views/compare.js',
  './js/views/legend.js',
  './js/views/exporter.js',
  './js/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' forces every file past the browser HTTP cache, so the
    // snapshot is coherent. Any failure aborts the install (old SW stays live).
    await Promise.all(SHELL.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(`shell fetch failed: ${url} -> ${res.status}`);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Anthropic / Photon go straight to network
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') { const shell = await caches.match('./index.html'); if (shell) return shell; }
      throw err;
    }
  })());
});
