// sw.js
const CACHE_NAME = 'mw-cotizador-v2'; // <- Cada vez que actualices tu código, cambia a v3, v4, etc.

const ARCHIVOS_A_GUARDAR = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', (event) => {
  // Obliga al nuevo service worker a activarse de inmediato
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_A_GUARDAR))
  );
});

self.addEventListener('activate', (event) => {
  // Elimina las versiones de caché viejas
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim()) // Toma control de la pantalla abierta al instante
  );
});

// Estrategia: Red primero (Network First) para el index.html
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
