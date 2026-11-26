// ADR-044: avisos push. El service worker lo carga con importScripts (vite.config.ts). Es JavaScript
// simple porque corre fuera de la app, sin compilar.

// El navegador exige mostrar una notificación con cada push; si el contenido falta o no se puede
// leer, se muestra una genérica en lugar de dejar que el navegador muestre la suya.
function readPayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

// Solo se abren direcciones de la propia app (`/…`): un aviso nunca saca a la persona del sitio.
function safeUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(typeof data.title === 'string' ? data.title : 'Valora', {
      body: typeof data.body === 'string' ? data.body : 'Tienes avisos nuevos',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: '/icon-192.png',
      data: { url: safeUrl(data.url) },
    }),
  );
});
