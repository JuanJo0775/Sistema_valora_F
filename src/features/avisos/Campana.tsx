import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../app/Icon';
import { type Avisos, type PendingCounts, useAvisos } from './avisosContext';
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

// Las pestañas del panel de moderación, en el mismo orden que el panel.
const QUEUES: { key: keyof PendingCounts; label: string }[] = [
  { key: 'precios', label: 'Precios' },
  { key: 'tiendas', label: 'Tiendas' },
  { key: 'productos', label: 'Productos' },
  { key: 'comercios', label: 'Comercios' },
];

function ModerationRows({ counts }: { counts: PendingCounts | undefined }) {
  return (
    <ul>
      {QUEUES.map(({ key, label }) => (
        <li key={key}>
          <Link to={`/moderacion?vista=${key}`} className="campana-fila">
            {label}
            {counts !== undefined && <span className="campana-numero">{counts[key]}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ADR-043: la campana del encabezado, solo para moderador y comercio.
export function Campana() {
  const avisos = useAvisos();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (avisos.kind === 'ninguno') return null;
  const total = totalOf(avisos);
  return (
    <div className="campana-caja">
      <button
        type="button"
        className="campana"
        aria-label={nameOf(total)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name="bell" />
        {total !== undefined && total > 0 && <span className="campana-total">{total}</span>}
      </button>
      {open && avisos.kind === 'moderador' && (
        <section id={panelId} className="campana-panel" aria-label="Pendientes de moderación">
          <ModerationRows counts={avisos.counts} />
        </section>
      )}
    </div>
  );
}
