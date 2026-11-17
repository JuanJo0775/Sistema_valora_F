import { useState } from 'react';
import { Link } from 'react-router';
import { readStored, writeStored } from '../../shared/storage';
import './legal.css';

const KEY = 'valora:aviso-cookies';

// Aviso de cookies. Valora solo usa las necesarias (sesión, CSRF y preferencias del dispositivo), que
// no piden aceptación: el aviso informa y se recuerda cuando la persona lo cierra.
export function CookieNotice() {
  const [seen, setSeen] = useState(() => readStored(KEY) === '1');
  if (seen) return null;
  return (
    <aside className="cookie-notice" aria-label="Aviso de cookies">
      <p>
        Valora usa solo cookies y almacenamiento necesarios para tu sesión y tus preferencias. No
        usamos cookies de publicidad ni de seguimiento.{' '}
        <Link to="/privacidad#cookies">Más información</Link>
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => {
          writeStored(KEY, '1');
          setSeen(true);
        }}
      >
        Entendido
      </button>
    </aside>
  );
}
