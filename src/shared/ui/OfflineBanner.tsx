import { useOfflineClaimed, useOnline } from './offline';

// ADR-010: la consulta necesita conexión. H-08: este aviso global solo sale cuando la pantalla
// muestra contenido (lo último que se vio); si la pantalla no puede mostrar nada sin internet,
// ella misma lo dice (ErrorState, OfflineMessage) y el aviso se esconde: un solo mensaje.
export function OfflineBanner() {
  const online = useOnline();
  const claimed = useOfflineClaimed();
  if (online || claimed) return null;
  return (
    <div className="banner warn" role="status">
      Sin conexión: te mostramos lo último que viste.
    </div>
  );
}
