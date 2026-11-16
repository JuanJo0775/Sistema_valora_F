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
  return <ErrorState error={error} />;
}
