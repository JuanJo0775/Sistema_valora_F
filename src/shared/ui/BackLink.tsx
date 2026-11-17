import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../../app/Icon';
import './backLink.css';

// react-router guarda en history.state.idx la posición dentro de la app: con idx > 0 hay una
// pantalla anterior de Valora y volver es seguro. Sin eso (enlace directo, WhatsApp, recarga) se
// usa la ruta de respaldo, para no sacar nunca a la persona de la app.
function hasAppHistory(): boolean {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

type Props = {
  /** Ruta a la que se va cuando no hay historial de la app. */
  fallback: string;
  /** Nombre del destino («Yo»); sin él, el texto es «Volver». */
  label?: string;
};

export function BackLink({ fallback, label }: Props) {
  const navigate = useNavigate();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!hasAppHistory()) return;
    event.preventDefault();
    void navigate(-1);
  };
  return (
    <Link
      to={fallback}
      className="back-link"
      aria-label={label ? `Volver a ${label}` : 'Volver'}
      onClick={onClick}
    >
      <Icon name="back" />
      <span>{label ?? 'Volver'}</span>
    </Link>
  );
}
