import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, call } from '../shared/api';
import { QueueContext, type SubmitResult } from './queueContext';
import {
  type NewReport,
  openReportQueue,
  type QueuedReport,
  type ReportQueue,
} from './reportQueue';

// POST /v1/reports con la clave del reporte; el X-CSRF-Token lo pone el cliente de la API.
const send = (report: QueuedReport) =>
  call(
    api.POST('/reports', {
      params: { header: { 'Idempotency-Key': report.idempotencyKey } },
      body: report.body,
    }),
  );

const RETRY_MS = 30_000;

// ADR-010: la cola de reportes en IndexedDB, abierta una vez para toda la app.
export function ReportQueueProvider({ children }: { children: ReactNode }) {
  const queue = useRef<Promise<ReportQueue> | null>(null);
  const [reports, setReports] = useState<QueuedReport[]>([]);

  const opened = useCallback(() => {
    queue.current ??= openReportQueue();
    return queue.current;
  }, []);

  const syncNow = useCallback(async () => {
    const reportQueue = await opened();
    await reportQueue.sync(send);
    setReports(await reportQueue.list());
  }, [opened]);

  // Al abrir la app se envía lo que quedó pendiente (OFFLINE_FIRST.md: el navegador no garantiza
  // la sincronización en segundo plano).
  useEffect(() => {
    void syncNow();
    // Y cada vez que vuelve la red (EC-07: p95 de confirmación de 60 s o menos tras reconectar).
    const onOnline = () => {
      void syncNow();
    };
    window.addEventListener('online', onOnline);
    // Con la red arriba pero el servidor fallando (5xx) no llega «online»: se reintenta cada 30 s.
    // Si no hay pendientes, solo se lee IndexedDB; no sale nada a la red.
    const every = setInterval(onOnline, RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(every);
    };
  }, [syncNow]);

  const submit = useCallback(
    async (report: NewReport): Promise<SubmitResult> => {
      const reportQueue = await opened();
      await reportQueue.add(report);
      let outcome = await reportQueue.sync(send);
      const find = async () =>
        (await reportQueue.list()).find((saved) => saved.idempotencyKey === report.idempotencyKey);
      let saved = await find();
      // Si ya corría otra sincronización, empezó antes de guardar este: se intenta una vez más.
      if (saved?.status === 'pendiente' && !outcome.needsSession) {
        outcome = await reportQueue.sync(send);
        saved = await find();
      }
      const result = await resultOf(reportQueue, saved, outcome.problem);
      setReports(await reportQueue.list());
      return result;
    },
    [opened],
  );

  const value = useMemo(() => ({ reports, submit }), [reports, submit]);
  return <QueueContext value={value}>{children}</QueueContext>;
}

// Lo que el servidor rechazó se explica en el formulario y sale de la cola: quien reporta decide
// si lo corrige. Una cuenta suspendida tampoco espera: no podrá enviarlo a tiempo (24 h).
async function resultOf(
  reportQueue: ReportQueue,
  saved: QueuedReport | undefined,
  sessionProblem: QueuedReport['problem'],
): Promise<SubmitResult> {
  if (!saved) return { kind: 'guardado' };
  if (saved.status === 'sincronizado') return { kind: 'recibido' };
  const problem =
    saved.status === 'requiere_atencion'
      ? saved.problem
      : sessionProblem?.code === 'ACCOUNT_SUSPENDED'
        ? sessionProblem
        : undefined;
  if (!problem) return { kind: 'guardado' };
  await reportQueue.discard(saved.idempotencyKey);
  return { kind: 'rechazado', problem: new ApiError(problem) };
}
