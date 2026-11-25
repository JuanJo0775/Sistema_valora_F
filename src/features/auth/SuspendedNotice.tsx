import { Link } from 'react-router';

// Las fechas se leen en la hora de Colombia, sin importar la zona del teléfono.
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });

// Por qué se suspendió (suspension.reason de la sesión, ADR-039). `no_registrada` (una suspensión
// anterior al registro de la causa) y cualquier motivo nuevo no llevan frase: no se inventa una.
const WHY: Record<string, string> = {
  observada_por_moderacion:
    'Moderación observó tu cuenta por un reporte de precio; esa decisión no se apela.',
  descartes_seguidos: 'Varios de tus reportes seguidos fueron descartados.',
};

// #71 del backend: una cuenta suspendida solo ve el estado de sus reportes y apela.
// onReports: el aviso ya está dentro de Mis aportes, así que no se enlaza a sí mismo.
export function SuspendedNotice({
  until,
  reason,
  onReports = false,
}: {
  until: string;
  reason?: string | undefined;
  onReports?: boolean;
}) {
  const why = reason ? WHY[reason] : undefined;
  // Observar la cuenta descarta el reporte sin plazo de apelación: no hay nada que apelar por ella.
  const appealable = reason !== 'observada_por_moderacion';
  return (
    <div role="alert" className="banner warn">
      <p>
        Tu cuenta está suspendida hasta el {DAY.format(new Date(until))}.{why && ` ${why}`} Mientras
        tanto puedes ver el estado de tus aportes{appealable ? ' y apelar' : ''}.
      </p>
      <p>
        {onReports ? (
          // Solo un reporte descartado con plazo abierto se puede apelar (AppealForm).
          appealable ? (
            'Para apelar, busca el reporte descartado y pulsa «Apelar».'
          ) : (
            'Si otro reporte tuyo fue descartado con plazo para apelar, pulsa «Apelar» en ese reporte.'
          )
        ) : (
          <Link to="/mis-aportes">Ver mis aportes</Link>
        )}
      </p>
    </div>
  );
}
