import { Link } from 'react-router';
import { useReportQueue } from './queueContext';

const reportsWord = (count: number) => (count === 1 ? 'reporte' : 'reportes');

// UX.md: el estado de la cola siempre a la vista mientras haya algo por enviar o por revisar.
export function PendingBanner() {
  const { reports } = useReportQueue();
  const pending = reports.filter(({ status }) => status === 'pendiente').length;
  const attention = reports.filter(({ status }) => status === 'requiere_atencion').length;
  if (pending === 0 && attention === 0) return null;
  const text = [
    pending > 0 && `${String(pending)} ${reportsWord(pending)} por enviar`,
    attention > 0 &&
      `${String(attention)} ${reportsWord(attention)} ${attention === 1 ? 'requiere' : 'requieren'} atención`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="banner warn">
      <Link to="/pendientes">{text}</Link>
    </div>
  );
}
