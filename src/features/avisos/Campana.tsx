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

// ADR-043: la campana del encabezado, solo para moderador y comercio.
export function Campana() {
  const avisos = useAvisos();
  if (avisos.kind === 'ninguno') return null;
  const total = totalOf(avisos);
  return (
    <button type="button" className="campana" aria-label={`Avisos: ${String(total)} pendientes`}>
      <Icon name="bell" />
      {total !== undefined && total > 0 && <span className="campana-total">{total}</span>}
    </button>
  );
}
