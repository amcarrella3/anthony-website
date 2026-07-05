// sw.js — offline app shell. Cache-first for our own files so the instrument
// loads at a restaurant table with no signal. Data lives in IndexedDB, not here.

const CACHE = 'lagman-log-v3';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/fonts/Aegean.woff2',
  './assets/fonts/Spartacus.woff2',
  './js/app.js',
  './js/schema.js',
  './js/store.js',
  './js/util.js',
  './js/notation.js',
  './js/naming.js',
  './js/charts.js',
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
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
