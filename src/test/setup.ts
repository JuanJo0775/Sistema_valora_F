import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
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

// Cada prueba arranca con un IndexedDB vacío (la cola sin conexión), como otro teléfono.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  // Y sin preferencias guardadas (último municipio, a dónde volver…).
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
