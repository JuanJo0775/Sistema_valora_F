import { ApiError } from '../shared/api';
import { formatCop } from '../shared/money';
import { EmptyState } from '../shared/ui/EmptyState';
import { ReportProblem } from '../features/reports/ReportProblem';
import { useReportQueue } from './queueContext';
import type { QueuedReport } from './reportQueue';

const STATUS: Record<QueuedReport['status'], string> = {
  pendiente: 'Por enviar',
  sincronizado: 'Enviado',
  requiere_atencion: 'Requiere atención',
};

// UX.md: el estado de cada reporte guardado en el teléfono (ADR-010).
export function PendingReports() {
  const { reports } = useReportQueue();
  if (reports.length === 0) {
    return <EmptyState title="No tienes reportes guardados en este teléfono" />;
  }
  return (
    <section className="pending">
      <h1>Reportes en este teléfono</h1>
      <ul className="offers">
        {reports.map((report) => (
          <li key={report.idempotencyKey} className="offer">
            <h2>{report.label.product}</h2>
            <p>{`${report.label.store} · ${formatCop(report.body.priceCop)}`}</p>
            <p className="badges">
              <span className={`pill ${TONE[report.status]}`}>{STATUS[report.status]}</span>
            </p>
            {report.problem && <ReportProblem error={new ApiError(report.problem)} />}
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
