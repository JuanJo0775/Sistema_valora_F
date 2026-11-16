import { Link } from 'react-router';
import { ApiError } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';

// Las horas se leen en la hora de Colombia, sin importar la zona del teléfono.
const HOUR = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: 'America/Bogota' });

// #11: lo que responde POST /v1/reports, dicho en palabras de quien reporta. Lo que no tiene un
// mensaje propio muestra el del servidor.
export function ReportProblem({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.code === 'DUPLICATE_REPORT' && error.availableFrom) {
    return (
      <p role="alert" className="banner warn">
        Ya registraste este producto en esta tienda hace poco. Podrás registrar otro precio desde
        las {HOUR.format(new Date(error.availableFrom))}.
      </p>
    );
  }
  // RF-012 RN2: más de 20 reportes observados en una misma hora (valor provisional del backend).
  if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
    const minutes = Math.ceil(error.retryAfterSeconds / 60);
    return (
      <p role="alert" className="banner warn">
        Registraste muchos precios en poco tiempo. Podrás registrar otro en {minutes}{' '}
        {minutes === 1 ? 'minuto' : 'minutos'}.
      </p>
    );
  }
  // Pasa si el reloj del teléfono está desfasado: el formulario ya revisa las 24 horas.
  if (error instanceof ApiError && error.code === 'INVALID_OBSERVATION_DATE') {
    return (
      <p role="alert" className="banner warn">
        La hora en que lo viste debe ser de las últimas 24 horas. Revisa «¿Cuándo lo viste?».
      </p>
    );
  }
  // #71 del backend: suspendida, la cuenta solo ve el estado de sus reportes y apela.
  if (error instanceof ApiError && error.code === 'ACCOUNT_SUSPENDED') {
    return (
      <p role="alert" className="banner warn">
        Tu cuenta está suspendida: por ahora no puedes registrar precios.{' '}
        <Link to="/mis-aportes">Ver mis aportes</Link>
      </p>
    );
  }
  return <ErrorState error={error} />;
}
