import { Link } from 'react-router';
import { formatCop } from '../../shared/money';
import { Loading } from '../../shared/ui/Loading';
import { SidePanel } from '../../shared/ui/SidePanel';
import { MUNICIPALITIES } from '../comparison/criteria';
import { placeLabel } from '../comparison/WherePicker';
import { useCanasta } from './canastaContext';
import { gainSentence, labelOf } from './RecommendationCards';
import './whereToBuy.css';

// «Dónde comprar», en la canasta, es un resumen corto: la mejor recomendación (la primera que calcula
// el motor, la más barata), su total, cuántas tiendas y lo que se ahorra. El detalle, el área, guardar
// y los supuestos viven en su propia pantalla (WherePage).
export function WhereSummary() {
  const { where, totals, found } = useCanasta();
  if (totals.status === 'empty') return null;
  const first = found?.items[0];
  const stores = first?.option.stores ?? 0;
  const gain = first ? gainSentence(first, where.point !== null) : '';
  const waiting = !where.ready || totals.status === 'loading';
  return (
    <SidePanel className="where-buy where-summary" aria-label="Dónde comprar">
      <h2>Dónde comprar</h2>
      {waiting ? (
        <Loading text={where.ready ? 'Buscando precios…' : 'Buscando tu ubicación…'} />
      ) : totals.status === 'failed' ? (
        <p className="muted">No pudimos calcular dónde te sale más barata.</p>
      ) : first ? (
        <>
          <p className="rec-label">{labelOf(first.kinds, MUNICIPALITIES[where.municipality])}</p>
          <p className="where-summary-total">
            <strong>{formatCop(first.productsCop)}</strong>
            <span className="muted">{` · ${stores === 1 ? '1 tienda' : `${String(stores)} tiendas`}`}</span>
          </p>
          {gain.startsWith('Ahorras') && <p>{gain}</p>}
          <p className="muted">{placeLabel(where)}</p>
        </>
      ) : (
        <p className="muted">Ningún producto de tu canasta tiene precio vigente en esta zona.</p>
      )}
      {!waiting && (
        <Link to="/canasta/donde-comprar" className="btn">
          Ver dónde comprar
        </Link>
      )}
    </SidePanel>
  );
}
