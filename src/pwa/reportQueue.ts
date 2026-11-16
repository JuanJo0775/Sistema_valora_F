import { type DBSchema, openDB } from 'idb';
import type { components } from '../shared/api/schema';

// ADR-010: los reportes se guardan en el teléfono ANTES de intentar enviarlos. Solo lo necesario
// para reenviarlos y mostrarlos: nunca la ubicación de quien reporta ni datos de su cuenta (EC-08).
export interface NewReport {
  idempotencyKey: string;
  body: components['schemas']['ReportCreate'];
  // Nombres públicos del catálogo y del directorio, para mostrar el reporte sin conexión.
  label: { product: string; store: string };
}

export type QueueStatus = 'pendiente' | 'sincronizado';

export interface QueuedReport extends NewReport {
  status: QueueStatus;
  savedAt: string;
  // syncedAt: cuándo lo confirmó el servidor; aparte de observedAt (OFFLINE_FIRST.md).
  syncedAt?: string;
}

interface QueueDb extends DBSchema {
  reports: { key: string; value: QueuedReport };
}

export interface ReportQueue {
  add: (report: NewReport) => Promise<void>;
  list: () => Promise<QueuedReport[]>;
  sync: (send: (report: QueuedReport) => Promise<unknown>) => Promise<void>;
}

export async function openReportQueue(name = 'valora'): Promise<ReportQueue> {
  const db = await openDB<QueueDb>(name, 1, {
    upgrade(database) {
      database.createObjectStore('reports', { keyPath: 'idempotencyKey' });
    },
  });
  return {
    add: async (report) => {
      await db.put('reports', {
        ...report,
        status: 'pendiente',
        savedAt: new Date().toISOString(),
      });
    },
    list: () => db.getAll('reports'),
    sync: () => Promise.resolve(),
  };
}
