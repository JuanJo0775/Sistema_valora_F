// ADR-044: avisos push. El service worker lo carga con importScripts (vite.config.ts). Es JavaScript
// simple porque corre fuera de la app, sin compilar.

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icon-192.png',
      data: { url: data.url },
    }),
  );
});
