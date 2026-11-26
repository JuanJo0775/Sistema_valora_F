import { Icon } from '../../app/Icon';
import { type Avisos, useAvisos } from './avisosContext';
import './avisos.css';

// Cuántos avisos hay. `undefined` es «todavía no hay respuesta»: la campana no muestra un número que
// no es verdad.
export function totalOf(avisos: Avisos): number | undefined {
  if (avisos.kind === 'moderador') {
    const { counts } = avisos;
    return counts && counts.precios + counts.tiendas + counts.productos + counts.comercios;
  }
  if (avisos.kind === 'comercio') return avisos.alerts?.length;
  return undefined;
}

// Lo que dice el lector de pantalla: el número también va en palabras, no solo en el círculo.
function nameOf(total: number | undefined): string {
  if (total === undefined) return 'Avisos';
  if (total === 0) return 'Avisos: nada pendiente';
  return `Avisos: ${String(total)} ${total === 1 ? 'pendiente' : 'pendientes'}`;
}

// ADR-043: la campana del encabezado, solo para moderador y comercio.
export function Campana() {
  const avisos = useAvisos();
  if (avisos.kind === 'ninguno') return null;
  const total = totalOf(avisos);
  return (
    <button type="button" className="campana" aria-label={nameOf(total)}>
      <Icon name="bell" />
      {total !== undefined && total > 0 && <span className="campana-total">{total}</span>}
    </button>
  );
}
