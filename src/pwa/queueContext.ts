import { createContext, useContext } from 'react';
import type { ApiError } from '../shared/api';
import type { NewReport, QueuedReport } from './reportQueue';

// Qué pasó con un reporte recién enviado desde el registro.
export type SubmitResult =
  | { kind: 'recibido' }
  // Sin red, 5xx o sin sesión: queda en el teléfono y la cola lo enviará sola.
  | { kind: 'guardado' }
  // El servidor lo rechazó (409, 422, 429, cuenta suspendida…): se explica en el formulario.
  | { kind: 'rechazado'; problem: ApiError };

export interface QueueState {
  reports: QueuedReport[];
  submit: (report: NewReport) => Promise<SubmitResult>;
}

export const QueueContext = createContext<QueueState>({
  reports: [],
  submit: () => Promise.resolve({ kind: 'guardado' }),
});

export const useReportQueue = () => useContext(QueueContext);
