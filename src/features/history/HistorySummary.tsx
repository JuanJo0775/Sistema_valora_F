import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { HistoryChart } from './HistoryChart';
import type { History } from './PriceHistory';
import './history.css';

// Prototipo de referencia: en el producto, una gráfica pequeña de los últimos 30 días (la primera
// presentación con precios). Si no hay datos o no cargan, no se muestra nada: el detalle sigue.
export function HistorySummary({ productId }: { productId: string }) {
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    call(api.GET('/products/{productId}/history', { params: { path: { productId } } }))
      .then(setHistory)
      .catch(() => undefined);
  }, [productId]);

  const series = history?.presentations.find(({ points }) => points.length > 0);
  if (!history || !series) return null;
  return (
    <section className="history-summary">
      <h2>Últimos 30 días</h2>
      <HistoryChart
        points={series.points}
        from={history.from}
        to={history.to}
        label={series.label}
      />
      <Link to={`/productos/${productId}/historial`}>Ver el historial</Link>
    </section>
  );
}
