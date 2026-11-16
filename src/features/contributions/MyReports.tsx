import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import './contributions.css';

type MyReport =
  paths['/me/reports']['get']['responses'][200]['content']['application/json']['items'][number];

// RF-013: el estado en palabras de quien reporta, sin decir quién decidió ni quién marcó (EC-08).
const STATUS: Record<MyReport['status'], { text: string; tone: string }> = {
  normal: { text: 'Vigente', tone: 'ok' },
  en_revision: { text: 'En revisión', tone: 'warn' },
  descartado: { text: 'Descartado', tone: 'bad' },
  apelacion_pendiente: { text: 'Apelación en revisión', tone: 'warn' },
  apelacion_aceptada: { text: 'Apelación aceptada', tone: 'ok' },
  apelacion_rechazada: { text: 'Apelación rechazada', tone: 'bad' },
};

// RF-006: mis aportes, el más reciente primero.
export function MyReports() {
  const [reports, setReports] = useState<MyReport[]>([]);

  useEffect(() => {
    void call(api.GET('/me/reports')).then(({ items }) => {
      setReports(items);
    });
  }, []);

  return (
    <section className="contributions">
      <h1>Mis aportes</h1>
      <ul className="offers">
        {reports.map((report) => (
          <li key={report.reportId} className="offer">
            <h2>{report.productName}</h2>
            <p className="muted">
              {[
                report.establishmentName,
                formatCop(report.priceCop),
                report.priceType === 'oferta' && 'oferta',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="badges">
              <span className={`pill ${STATUS[report.status].tone}`}>
                {STATUS[report.status].text}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
