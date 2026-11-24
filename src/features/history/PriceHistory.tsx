import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components, paths } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { SelectField } from '../../shared/ui/SelectField';
import { shortDay } from '../../shared/days';
import { useMediaQuery } from '../../shared/useMediaQuery';
import { HistoryChart } from './HistoryChart';
import { changeText, historyStats } from './stats';
import './history.css';
import { BackLink } from '../../shared/ui/BackLink';

export type History =
  paths['/products/{productId}/history']['get']['responses'][200]['content']['application/json'];
type Product = components['schemas']['Product'];

// #17 (RF-008 RN4): precios de los últimos 30 días por presentación. Los días sin precios no se
// muestran ni se inventan.
export function PriceHistory() {
  const { productId = '' } = useParams();
  const [outcome, setOutcome] = useState<
    { product: Product; history: History } | { error: unknown } | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState('');
  const wide = useMediaQuery('(width >= 640px)');

  useEffect(() => {
    Promise.all([
      call(api.GET('/products/{productId}', { params: { path: { productId } } })),
      call(api.GET('/products/{productId}/history', { params: { path: { productId } } })),
    ])
      .then(([product, history]) => {
        setOutcome({ product, history });
      })
      .catch((error: unknown) => {
        setOutcome({ error });
      });
  }, [productId, attempt]);

  if (!outcome) return <Loading />;
  if ('error' in outcome) {
    return (
      <ErrorState
        error={outcome.error}
        onRetry={() => {
          setOutcome(null);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  const { product, history } = outcome;
  const series =
    history.presentations.find(({ presentationId }) => presentationId === chosen) ??
    history.presentations[0];
  const stats = series ? historyStats(series.points, history.to) : null;
  return (
    <section className="history">
      <BackLink fallback={`/productos/${productId}`} />
      <h1>Historial de precios</h1>
      <p className="history-product">{product.name}</p>
      <p className="muted">{`Últimos 30 días: del ${shortDay(history.from)} al ${shortDay(history.to)}.`}</p>
      {!series ? (
        <EmptyState title="Todavía no hay precios de este producto en los últimos 30 días" />
      ) : (
        <>
          {history.presentations.length > 1 && (
            <SelectField
              label="Presentación"
              value={series.presentationId}
              options={history.presentations.map(({ presentationId, label }) => ({
                value: presentationId,
                label,
              }))}
              onChange={setChosen}
            />
          )}
          {stats && <HistoryStatCards stats={stats} />}
          <HistoryChart
            points={series.points}
            from={history.from}
            to={history.to}
            label={series.label}
            wide={wide}
          />
          <details className="history-table">
            <summary>{`Ver la tabla de precios (${String(series.points.length)})`}</summary>
            <table>
              <caption>{`Precio por día · ${series.label}`}</caption>
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Más bajo</th>
                  <th scope="col">Promedio</th>
                  <th scope="col">Reportes</th>
                </tr>
              </thead>
              <tbody>
                {series.points.map((point) => (
                  <tr key={point.date}>
                    <th scope="row">{shortDay(point.date)}</th>
                    <td>{formatCop(point.minPriceCop)}</td>
                    <td>{formatCop(point.avgPriceCop)}</td>
                    <td>{point.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

// Mínimo, máximo, el precio de hoy y la variación, de los mismos puntos de la tabla.
function HistoryStatCards({ stats }: { stats: NonNullable<ReturnType<typeof historyStats>> }) {
  const { latest } = stats;
  const cards: [string, string][] = [
    ['Más bajo', formatCop(stats.min)],
    ['Más alto', formatCop(stats.max)],
    [latest.isToday ? 'Hoy' : `Último (${shortDay(latest.date)})`, formatCop(latest.priceCop)],
    ['Variación', changeText(stats.change)],
  ];
  return (
    <ul className="history-stats" aria-label="Resumen del periodo">
      {cards.map(([label, value]) => (
        <li key={label} className="history-stat">
          <span className="history-stat-label">{label}</span>
          <span className="history-stat-value">{value}</span>
        </li>
      ))}
    </ul>
  );
}
