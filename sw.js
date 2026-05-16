// RotaBoa — Service Worker (MVP)
// Estratégia: Cache First para assets estáticos, Network First para tudo mais.

const CACHE_NAME = 'rotaboa-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/responsive.css',
  './assets/js/icons.js',
  './assets/js/app.js',
  './assets/js/router.js',
  './assets/js/store.js',
  './assets/js/mockData.js',
  './assets/js/ui.js',
  './assets/js/bagagem.js',
  './assets/js/planoDiretor.js',
  './assets/js/firebaseClient.js',
  './assets/js/mapsService.js',
  './assets/js/packingCatalog.js',
  './assets/img/logo-placeholder.svg',
];

// Instala e armazena os assets em cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Remove caches antigos ao ativar
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepta requisições: tenta o cache primeiro, depois a rede
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
