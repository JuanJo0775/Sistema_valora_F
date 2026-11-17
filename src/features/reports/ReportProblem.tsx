import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';

// Las horas se leen en la hora de Colombia, sin importar la zona del teléfono.
const HOUR = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: 'America/Bogota' });

const Notice = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="banner warn">
    {children}
  </p>
);

// #11: lo que responde POST /v1/reports, dicho en palabras de quien reporta. Lo que no tiene un
// mensaje propio muestra el del servidor.
export function ReportProblem({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) return <ErrorState error={error} />;
  if (error.code === 'DUPLICATE_REPORT' && error.availableFrom) {
    return (
      <Notice>
        Ya registraste este producto en esta tienda hace poco. Podrás registrar otro precio desde
        las {HOUR.format(new Date(error.availableFrom))}.
      </Notice>
    );
  }
  // RF-012 RN2: más de 20 reportes observados en una misma hora (valor provisional del backend).
  if (error.status === 429 && error.retryAfterSeconds) {
    const minutes = Math.ceil(error.retryAfterSeconds / 60);
    return (
      <Notice>
        Registraste muchos precios en poco tiempo. Podrás registrar otro en {minutes}{' '}
        {minutes === 1 ? 'minuto' : 'minutos'}.
      </Notice>
    );
  }
  // Pasa si el reloj del teléfono está desfasado: el formulario ya revisa las 24 horas.
  if (error.code === 'INVALID_OBSERVATION_DATE') {
    return (
      <Notice>
        La hora en que lo viste debe ser de las últimas 24 horas. Revisa «¿Cuándo lo viste?».
      </Notice>
    );
  }
  // #71 del backend: suspendida, la cuenta solo ve el estado de sus reportes y apela.
  if (error.code === 'ACCOUNT_SUSPENDED') {
    return (
      <Notice>
        Tu cuenta está suspendida: por ahora no puedes registrar precios.{' '}
        <Link to="/mis-aportes">Ver mis aportes</Link>
      </Notice>
    );
  }
  return <ErrorState error={error} />;
}
