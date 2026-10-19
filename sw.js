// sw.js
const CACHE_NAME = 'mw-cotizador-v3'; // Incrementa a v4, v5 en cada despliegue

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
      // Guarda archivo por archivo para que un 404 en logo.png no impida instalar la app
      for (const recurso of ARCHIVOS_A_GUARDAR) {
        try {
          await cache.add(recurso);
        } catch (err) {
          console.warn('Recurso opcional no cacheado:', recurso);
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
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia: Red primero para navegación y Cache-First seguro solo para GET
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones de Firebase Firestore (POST, streamings, APIs)
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
