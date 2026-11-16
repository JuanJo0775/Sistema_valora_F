import { type ReactNode, useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import { type Session, SessionContext } from './session';

// ADR-014: la sesión es una cookie del servidor; la app pregunta quién es al abrirse.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  useEffect(() => {
    call(api.GET('/auth/session'))
      .then(({ role, suspendedUntil }) => {
        setSession({ status: 'active', role, suspendedUntil });
      })
      .catch(() => {
        setSession({ status: 'anonymous' });
      });
  }, []);

  return <SessionContext value={session}>{children}</SessionContext>;
}
