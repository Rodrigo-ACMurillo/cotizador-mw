// sw.js
// Versión de la aplicación. Cámbiala en cada publicación para que los dispositivos detecten la actualización.
const VERSION = 'v6';
const CACHE_APP = `mw-cotizador-app-${VERSION}`;
const CACHE_CDN = 'mw-cotizador-cdn-v1';

// Si la red no responde en este tiempo, la navegación se sirve desde la copia guardada
const ESPERA_RED_NAVEGACION_MS = 4000;

// Archivos propios. Los que no existan (por ejemplo los íconos) se omiten sin romper la instalación.
const ARCHIVOS_LOCALES = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Librerías externas con versión fija. Se guardan para que la app abra sin internet.
const LIBRERIAS_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js'
];

// Solo estos orígenes se guardan en caché. Firestore y Auth (googleapis.com) nunca pasan por aquí.
function esRecursoCdn(url) {
  return url.hostname === 'cdnjs.cloudflare.com'
    || url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
    || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
}

self.addEventListener('install', (event) => {
  // Sin skipWaiting aquí: la versión nueva espera hasta que el usuario acepte la actualización.
  event.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    const cdn = await caches.open(CACHE_CDN);
    await Promise.allSettled([
      ...ARCHIVOS_LOCALES.map((ruta) => app.add(new Request(ruta, { cache: 'reload' }))),
      ...LIBRERIAS_CDN.map((url) => cdn.add(new Request(url, { mode: 'cors' })))
    ]);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(
      claves
        .filter((clave) => clave !== CACHE_APP && clave !== CACHE_CDN)
        .map((clave) => caches.delete(clave))
    );
    await self.clients.claim();
  })());
});

// La página pide activar la versión nueva cuando el usuario pulsa "Actualizar ahora"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Navegación: red primero (con límite de espera) y copia guardada como respaldo
async function manejarNavegacion(event) {
  const cache = await caches.open(CACHE_APP);

  const desdeRed = fetch(event.request).then((resp) => {
    if (resp.ok && !resp.redirected) {
      cache.put('./index.html', resp.clone());
    }
    return resp;
  });
  // Aunque se agote la espera, la descarga sigue y deja la copia fresca para la próxima vez
  event.waitUntil(desdeRed.catch(() => {}));

  const limite = new Promise((_, rechazar) => {
    setTimeout(() => rechazar(new Error('Tiempo de espera agotado')), ESPERA_RED_NAVEGACION_MS);
  });

  try {
    return await Promise.race([desdeRed, limite]);
  } catch (err) {
    return (await cache.match('./index.html'))
      || (await cache.match('./'))
      || Response.error();
  }
}

// Recursos estáticos: responde desde caché y actualiza en segundo plano
async function conCacheYActualizacion(event, nombreCache, propio) {
  const cache = await caches.open(nombreCache);
  const guardado = await cache.match(event.request, { ignoreVary: true });

  const peticion = propio
    ? fetch(event.request.url, { cache: 'no-cache' })
    : fetch(event.request);

  const actualizacion = peticion.then((resp) => {
    if (resp && resp.ok) cache.put(event.request, resp.clone());
    return resp;
  }).catch(() => null);

  event.waitUntil(actualizacion);

  if (guardado) return guardado;
  return (await actualizacion) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Firestore, Auth y cualquier escritura pasan directo a la red
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(manejarNavegacion(event));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(conCacheYActualizacion(event, CACHE_APP, true));
    return;
  }

  if (esRecursoCdn(url)) {
    event.respondWith(conCacheYActualizacion(event, CACHE_CDN, false));
  }
});
