import { type DBSchema, openDB } from 'idb';
import { ApiError } from '../shared/api';
import type { components } from '../shared/api/schema';

// ADR-010: los reportes se guardan en el teléfono ANTES de intentar enviarlos. Solo lo necesario
// para reenviarlos y mostrarlos: nunca la ubicación de quien reporta ni datos de su cuenta (EC-08).
export interface NewReport {
  idempotencyKey: string;
  body: components['schemas']['ReportCreate'];
  // Nombres públicos del catálogo y del directorio, para mostrar el reporte sin conexión.
  label: { product: string; store: string };
}

export type QueueStatus = 'pendiente' | 'sincronizado' | 'requiere_atencion';

// El motivo como dato simple: IndexedDB no conserva los campos propios de un Error al guardarlo.
export interface QueueProblem {
  status: number;
  code: string;
  message: string;
  availableFrom?: string;
  retryAfterSeconds?: number;
}

export interface QueuedReport extends NewReport {
  status: QueueStatus;
  savedAt: string;
  // syncedAt: cuándo lo confirmó el servidor; aparte de observedAt (OFFLINE_FIRST.md).
  syncedAt?: string;
  problem?: QueueProblem;
}

interface QueueDb extends DBSchema {
  reports: { key: string; value: QueuedReport };
}

export interface SyncOutcome {
  needsSession: boolean;
}

export interface ReportQueue {
  add: (report: NewReport) => Promise<void>;
  list: () => Promise<QueuedReport[]>;
  discard: (idempotencyKey: string) => Promise<void>;
  sync: (send: (report: QueuedReport) => Promise<unknown>) => Promise<SyncOutcome>;
}

export async function openReportQueue(name = 'valora'): Promise<ReportQueue> {
  const db = await openDB<QueueDb>(name, 1, {
    upgrade(database) {
      database.createObjectStore('reports', { keyPath: 'idempotencyKey' });
    },
  });
  // Una sola sincronización a la vez (al abrir la app, al volver la red y cada 30 s pueden
  // coincidir): las demás esperan la que está en curso en vez de reenviar los mismos reportes.
  let running: Promise<SyncOutcome> | null = null;
  const syncOnce = async (
    send: (report: QueuedReport) => Promise<unknown>,
  ): Promise<SyncOutcome> => {
    // Un reporte por petición (no hay ruta de lotes), del más antiguo al más nuevo, siempre con su
    // misma clave: si el servidor ya lo tenía responde 200 y no lo duplica (EC-07).
    const pending = (await db.getAll('reports'))
      .filter(({ status }) => status === 'pendiente')
      .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    for (const report of pending) {
      try {
        await send(report);
      } catch (error) {
        // #9: 400, 409, 422 o 429 son finales. Reenviar el mismo reporte nunca pasa: su hora de
        // observación no cambia. Sale de la cola de envío y avisa por qué.
        if (error instanceof ApiError && FINAL.has(error.status)) {
          await db.put('reports', {
            ...report,
            status: 'requiere_atencion',
            problem: plain(error),
          });
          continue;
        }
        // 401 o 403: sin sesión (o vencida) los demás tampoco pasarán. Siguen pendientes y,
        // después de iniciar sesión, se reintentan con la misma clave.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return { needsSession: true };
        }
        // Sin red o 5xx: queda pendiente y se reintenta después con la misma clave. Se detiene
        // aquí: si el servidor no contesta a este, tampoco contestará a los siguientes.
        return { needsSession: false };
      }
      await db.put('reports', {
        ...report,
        status: 'sincronizado',
        syncedAt: new Date().toISOString(),
      });
    }
    return { needsSession: false };
  };
  return {
    add: async (report) => {
      await db.put('reports', {
        ...report,
        status: 'pendiente',
        savedAt: new Date().toISOString(),
      });
    },
    list: () => db.getAll('reports'),
    discard: (idempotencyKey) => db.delete('reports', idempotencyKey),
    sync: (send) => {
      running ??= syncOnce(send).finally(() => {
        running = null;
      });
      return running;
    },
  };
}

const FINAL = new Set([400, 409, 422, 429]);

const plain = ({ status, code, message, availableFrom, retryAfterSeconds }: ApiError) => ({
  status,
  code,
  message,
  ...(availableFrom ? { availableFrom } : {}),
  ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
});
