import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

// El registro del service worker es un módulo virtual de vite-plugin-pwa que no existe en las
// pruebas: por defecto, sin versión nueva. UpdateBanner.spec lo simula a su manera.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Bajo carga (la CI o varios trabajadores) la primera pantalla tarda más de 1 s en cargar; con el
// límite por defecto de findBy y waitFor la prueba se rendía sin que nada estuviera mal. Una prueba
// que de verdad falla sigue fallando: solo espera más antes de rendirse.
configure({ asyncUtilTimeout: 5000 });
// vi.waitFor tiene su propio límite (1 s) y no lo toca la configuración anterior: mismo margen.
const waitFor = vi.waitFor.bind(vi);
vi.waitFor = (callback, options) =>
  waitFor(callback, typeof options === 'number' ? options : { timeout: 5000, ...options });

// Cada prueba arranca con un IndexedDB vacío (la cola sin conexión), como otro teléfono.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  // Y sin preferencias guardadas (último municipio, a dónde volver…).
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

// jsdom no trae scrollIntoView (las listas lo usan para mostrar la opción activa).
Element.prototype.scrollIntoView = vi.fn();
