import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { relativeDay } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { type MyReport, STATUS } from './MyReports';
import './contributions.css';

const SHOWN = 3;

// #79 (prototipo): en «Yo», los últimos aportes con su estado y el enlace a todos (RF-006, RF-013).
export function RecentReports() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    call(api.GET('/me/reports'))
      .then(({ items }) => {
        setReports(items.slice(0, SHOWN));
      })
      // Si no cargan, el resto de «Yo» se sigue viendo.
      .catch(() => {
        setFailed(true);
      });
  }, []);

  return (
    <section className="recent-reports" aria-labelledby="mis-aportes">
      <h2 id="mis-aportes" className="eyebrow">
        Mis aportes
      </h2>
      {failed && <p className="muted">No pudimos cargar tus aportes.</p>}
      {reports?.length === 0 && (
        <p className="muted">Todavía no has registrado precios. Cada uno ayuda a tu barrio.</p>
      )}
      {reports && reports.length > 0 && (
        <ul aria-labelledby="mis-aportes" className="recent-list">
          {reports.map((report) => (
            <li key={report.reportId}>
              <span className="recent-text">
                <strong>{`${report.productName} · ${formatCop(report.priceCop)}`}</strong>
                <span className="muted">{`${report.establishmentName} · ${relativeDay(report.observedAt)}`}</span>
              </span>
              <span className={`pill ${STATUS[report.status].tone}`}>
                {STATUS[report.status].text}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/mis-aportes" aria-label="Ver todos mis aportes">
        Ver todos
      </Link>
    </section>
  );
}
