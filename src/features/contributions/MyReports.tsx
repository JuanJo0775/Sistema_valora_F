import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { dayInColombia } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonList } from '../../shared/ui/Skeleton';
import { useSession } from '../auth/session';
import { SuspendedNotice } from '../auth/SuspendedNotice';
import { AppealForm } from './AppealForm';
import './contributions.css';
import { BackLink } from '../../shared/ui/BackLink';

export type MyReport =
  paths['/me/reports']['get']['responses'][200]['content']['application/json']['items'][number];

// RF-013: el estado en palabras de quien reporta, sin decir quién decidió ni quién marcó (EC-08).
export const STATUS: Record<MyReport['status'], { text: string; tone: string }> = {
  normal: { text: 'Vigente', tone: 'ok' },
  en_revision: { text: 'En revisión', tone: 'warn' },
  descartado: { text: 'Descartado', tone: 'bad' },
  apelacion_pendiente: { text: 'Apelación en revisión', tone: 'warn' },
  apelacion_aceptada: { text: 'Apelación aceptada', tone: 'ok' },
  apelacion_rechazada: { text: 'Apelación rechazada', tone: 'bad' },
};

// Qué significa cada estado, en una frase (la etiqueta sola no lo dice).
const MEANING: Record<MyReport['status'], string> = {
  normal: 'Ya cuenta en la comparación.',
  en_revision: 'Un moderador lo está revisando.',
  descartado: 'No quedó en la comparación.',
  apelacion_pendiente: 'Un moderador está revisando tu apelación.',
  apelacion_aceptada: 'Un moderador aceptó tu apelación.',
  apelacion_rechazada: 'Un moderador rechazó tu apelación.',
};

// RF-006: mis aportes, el más reciente primero, por páginas (#76 del backend).
export function MyReports() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | undefined>();
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const { session } = useSession();
  const suspendedUntil = session.status === 'active' ? session.suspendedUntil : undefined;

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

  // El servidor ya la recibió: el aporte queda «Apelación en revisión» sin volver a pedir la lista.
  const markAppealed = (reportId: string) => {
    setReports((current) =>
      (current ?? []).map((report) =>
        report.reportId === reportId
          ? { ...report, status: 'apelacion_pendiente', appealableUntil: undefined }
          : report,
      ),
    );
  };

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
  if (!reports) return <SkeletonList kind="row" />;
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
      <BackLink fallback="/yo" />
      <h1>Mis aportes</h1>
      {/* #71 del backend: suspendida, la cuenta solo ve el estado de sus aportes y apela. */}
      {suspendedUntil && (
        <SuspendedNotice
          until={suspendedUntil}
          reason={session.status === 'active' ? session.suspensionReason : undefined}
          onReports
        />
      )}
      <ul className="offers">
        {reports.map((report) => (
          <li key={report.reportId} className="offer">
            <h2>
              {report.productId ? (
                <Link to={`/productos/${report.productId}`}>{report.productName}</Link>
              ) : (
                report.productName
              )}
            </h2>
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
            <p className="muted">{MEANING[report.status]}</p>
            {report.status === 'descartado' && report.appealableUntil && (
              <AppealForm
                reportId={report.reportId}
                until={report.appealableUntil}
                onAppealed={() => {
                  markAppealed(report.reportId);
                }}
              />
            )}
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
