import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { dayInColombia } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
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

// RF-006: mis aportes, el más reciente primero, por páginas (#76 del backend).
export function MyReports() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback((before?: string) => {
    call(api.GET('/me/reports', { params: { query: before ? { before } : {} } }))
      .then(({ items, nextBefore: next }) => {
        setReports((current) => (before ? [...(current ?? []), ...items] : items));
        setNextBefore(next);
      })
      .catch((failure: unknown) => {
        setError(failure);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, attempt]);

  if (error !== null) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setError(null);
          setReports(null);
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  if (!reports) return <Loading />;
  if (reports.length === 0) {
    return (
      <EmptyState
        title="Todavía no has registrado precios"
        action={
          <Link to="/registrar" className="btn">
            Registrar precio
          </Link>
        }
      />
    );
  }
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
            <p className="muted">{`Visto el ${dayInColombia(report.observedAt)}`}</p>
            <p className="badges">
              <span className={`pill ${STATUS[report.status].tone}`}>
                {STATUS[report.status].text}
              </span>
            </p>
          </li>
        ))}
      </ul>
      {nextBefore && (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            load(nextBefore);
          }}
        >
          Ver más
        </button>
      )}
    </section>
  );
}
