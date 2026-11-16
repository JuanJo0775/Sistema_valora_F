import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

// Cada prueba arranca con un IndexedDB vacío (la cola sin conexión), como otro teléfono.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  cleanup();
});
