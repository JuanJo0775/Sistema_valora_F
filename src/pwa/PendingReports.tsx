import { Link } from 'react-router';
import { ApiError } from '../shared/api';
import { formatCop } from '../shared/money';
import { EmptyState } from '../shared/ui/EmptyState';
import { ReportProblem } from '../features/reports/ReportProblem';
import { useReportQueue } from './queueContext';
import type { QueuedReport } from './reportQueue';
import { BackLink } from '../shared/ui/BackLink';

const STATUS: Record<QueuedReport['status'], string> = {
  pendiente: 'Por enviar',
  sincronizado: 'Enviado',
  requiere_atencion: 'Requiere atención',
};

// UX.md: el estado de cada reporte guardado en el teléfono (ADR-010).
export function PendingReports() {
  const { reports, needsSession, discard } = useReportQueue();
  if (reports.length === 0) {
    return <EmptyState title="No tienes reportes guardados en este teléfono" level={1} />;
  }
  return (
    <section className="pending">
      <BackLink fallback="/yo" />
      <h1>Reportes en este teléfono</h1>
      {needsSession && (
        <p role="alert" className="banner warn">
          <Link to="/entrar?volver=%2Fpendientes">Inicia sesión para enviarlos</Link>
        </p>
      )}
      {/* OFFLINE_FIRST.md: el navegador no garantiza la sincronización en segundo plano. */}
      {reports.some(({ status }) => status === 'pendiente') && (
        <p className="muted">
          Se envían solos cuando hay conexión. Si no salen, abre Valora con internet: el navegador
          no siempre los envía con la app cerrada.
        </p>
      )}
      <ul className="offers">
        {reports.map((report) => (
          <li key={report.idempotencyKey} className="offer">
            <h2>{report.label.product}</h2>
            <p>{`${report.label.store} · ${formatCop(report.body.priceCop)}`}</p>
            <p className="badges">
              <span className={`pill ${TONE[report.status]}`}>{STATUS[report.status]}</span>
            </p>
            {report.status === 'requiere_atencion' && (
              <>
                {report.problem && <ReportProblem error={new ApiError(report.problem)} />}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void discard(report.idempotencyKey)}
                >
                  Descartar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const TONE: Record<QueuedReport['status'], string> = {
  pendiente: 'warn',
  sincronizado: 'ok',
  requiere_atencion: 'bad',
};
