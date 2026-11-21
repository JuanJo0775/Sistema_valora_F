import { useState } from 'react';
import { ResendVerification } from './ResendVerification';
import { useSession } from './session';
import './auth.css';

const DISMISSED = 'valora.verify-notice-dismissed';

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
};

// ADR-029: con una cuenta sin el correo verificado se puede navegar, pero no registrar precios. El
// aviso es compacto, se puede cerrar durante la sesión de navegación y deja pedir otro enlace (el
// servidor limita a 3 por hora). Cerrado, el motivo sigue a la vista donde importa: al registrar.
export function VerifyEmailBanner() {
  const { session } = useSession();
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (
    dismissed ||
    session.status !== 'active' ||
    session.emailVerified ||
    !session.emailVerificationRequired
  ) {
    return null;
  }

  return (
    <div className="banner warn verify-notice">
      <p>
        Verifica tu correo para registrar precios (el enlace vale 24 horas). Para comparar y ver el
        mapa no hace falta. <ResendVerification />
      </p>
      <button
        type="button"
        className="verify-notice-close"
        aria-label="Cerrar aviso"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISSED, '1');
          } catch {
            // Sin almacenamiento, el aviso se cierra solo hasta recargar.
          }
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
