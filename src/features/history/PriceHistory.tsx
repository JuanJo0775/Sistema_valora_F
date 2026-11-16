import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import { shortDay } from './days';
import { HistoryChart } from './HistoryChart';
import './history.css';

export type History =
  paths['/products/{productId}/history']['get']['responses'][200]['content']['application/json'];

// #17 (RF-008 RN4): precios de los últimos 30 días por presentación. Los días sin precios no se
// muestran ni se inventan.
export function PriceHistory() {
  const { productId = '' } = useParams();
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    void call(api.GET('/products/{productId}/history', { params: { path: { productId } } })).then(
      setHistory,
    );
  }, [productId]);

  const [series] = history?.presentations ?? [];
  if (!series) return null;
  return (
    <section className="history">
      <HistoryChart
        points={series.points}
        from={history?.from ?? ''}
        to={history?.to ?? ''}
        label={series.label}
      />
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
    </section>
  );
}
