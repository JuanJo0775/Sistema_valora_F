// Las fechas se leen en la hora de Colombia, sin importar la zona del teléfono.
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' });

// #71 del backend: una cuenta suspendida solo ve el estado de sus reportes y apela.
export function SuspendedNotice({ until }: { until: string }) {
  return (
    <p role="alert" className="banner warn">
      Tu cuenta está suspendida hasta el {DAY.format(new Date(until))}. Mientras tanto puedes ver el
      estado de tus aportes y apelar.
    </p>
  );
}
