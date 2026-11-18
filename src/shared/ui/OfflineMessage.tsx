import type { ReactNode } from 'react';
import { useClaimOfflineNotice } from './offline';

// El mensaje de «sin conexión» de una pantalla. Reclama el aviso: el global se esconde.
export function OfflineMessage({ children }: { children: ReactNode }) {
  useClaimOfflineNotice();
  return (
    <p role="status" className="banner warn">
      {children}
    </p>
  );
}
