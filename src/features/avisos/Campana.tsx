import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../app/Icon';
import { type Avisos, type MerchantAlert, type PendingCounts, useAvisos } from './avisosContext';
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

// Los avisos del comercio llevan a su pantalla, donde reconfirma o corrige sus precios.
function MerchantRows({ alerts }: { alerts: MerchantAlert[] | undefined }) {
  if (alerts?.length === 0) return <p className="campana-vacio muted">Nada pendiente por ahora.</p>;
  return (
    <ul>
      {(alerts ?? []).map(({ kind, presentationId, message }) => (
        <li key={`${kind}:${presentationId}`}>
          <Link to="/comercios" className="campana-fila">
            {message}
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
  const boxRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // WCAG 2.2: el panel se cierra con Escape (el foco vuelve a la campana) y al tocar fuera.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      bellRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (avisos.kind === 'ninguno') return null;
  const total = totalOf(avisos);
  return (
    <div className="campana-caja" ref={boxRef}>
      <button
        ref={bellRef}
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
      {open && (
        <section
          id={panelId}
          className="campana-panel"
          aria-label={avisos.kind === 'moderador' ? 'Pendientes de moderación' : 'Tus avisos'}
          onClick={(event) => {
            // Elegir una fila lleva a su pantalla: el panel ya cumplió.
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
        >
          {avisos.kind === 'moderador' ? (
            <ModerationRows counts={avisos.counts} />
          ) : (
            <MerchantRows alerts={avisos.alerts} />
          )}
        </section>
      )}
    </div>
  );
}
