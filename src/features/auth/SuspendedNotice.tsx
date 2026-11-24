import { Link } from 'react-router';

// Las fechas se leen en la hora de Colombia, sin importar la zona del teléfono.
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });

// Por qué se suspendió (suspension.reason de la sesión). Un motivo que no esté aquí no se explica.
const WHY: Record<string, string> = {
  observada_por_moderacion: 'Moderación observó tu cuenta por un reporte de precio.',
  descartes_seguidos: 'Varios de tus reportes seguidos fueron descartados.',
  rafaga: 'Enviaste demasiados reportes en poco tiempo.',
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
  return (
    <div role="alert" className="banner warn">
      <p>
        Tu cuenta está suspendida hasta el {DAY.format(new Date(until))}.{why && ` ${why}`} Mientras
        tanto puedes ver el estado de tus aportes y apelar.
      </p>
      <p>
        {onReports ? (
          // Solo un reporte descartado se puede apelar (AppealForm).
          'Para apelar, busca el reporte descartado y pulsa «Apelar».'
        ) : (
          <Link to="/mis-aportes">Ver mis aportes</Link>
        )}
      </p>
    </div>
  );
}
