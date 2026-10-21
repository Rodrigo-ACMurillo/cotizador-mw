// sw.js
const CACHE_NAME = 'mw-cotizador-v4'; // <- Incrementado para forzar la actualización del nuevo index.html

const ARCHIVOS_A_GUARDAR = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Guarda recurso por recurso para evitar que un fallo en logo.png cancele la instalación
      for (const recurso of ARCHIVOS_A_GUARDAR) {
        try {
          await cache.add(recurso);
        } catch (err) {
          console.warn('Recurso no cacheado en install:', recurso);
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Elimina v1, v2, v3 y cualquier caché antigua
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim()) // Toma control de la pantalla abierta de inmediato
  );
});

// Estrategia: Red primero para navegación y Cache-First seguro solo para peticiones GET
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones de Firebase Firestore (POST, streams, APIs internas)
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((resCache) => {
      return resCache || fetch(event.request);
    })
  );
});
