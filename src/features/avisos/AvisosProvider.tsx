import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { api, call } from '../../shared/api';
import { useSession } from '../auth/session';
import { type Avisos, AvisosContext } from './avisosContext';
import { usePolling } from './usePolling';

// ADR-043: cada cuánto se consultan los avisos mientras la app está visible.
export const AVISOS_INTERVAL_MS = 60_000;

// Consulta los avisos del rol de la sesión y los reparte a la campana, las pestañas del panel y «Yo».
// Una sola consulta para toda la app, no una por componente.
export function AvisosProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const role = session.status === 'active' ? session.role : null;

  const loadSummary = useCallback(
    (signal: AbortSignal) => call(api.GET('/moderation/summary', { signal })),
    [],
  );
  const [summarySignal, setSummarySignal] = useState(0);
  const refresh = useCallback(() => {
    setSummarySignal((current) => current + 1);
  }, []);
  const counts = usePolling(loadSummary, AVISOS_INTERVAL_MS, role === 'moderador', summarySignal);

  const loadAlerts = useCallback(
    (signal: AbortSignal) =>
      call(api.GET('/commerce/alerts', { signal })).then(({ items }) => items),
    [],
  );
  const alerts = usePolling(loadAlerts, AVISOS_INTERVAL_MS, role === 'comercio');

  const value = useMemo<Avisos>(() => {
    if (role === 'moderador') return { kind: 'moderador', counts, refresh };
    if (role === 'comercio') return { kind: 'comercio', alerts };
    return { kind: 'ninguno' };
  }, [role, counts, alerts, refresh]);

  return <AvisosContext.Provider value={value}>{children}</AvisosContext.Provider>;
}
