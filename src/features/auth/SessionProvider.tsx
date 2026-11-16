import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { type Session, SessionContext } from './session';

// ADR-014: la sesión es una cookie del servidor; la app pregunta quién es al abrirse.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    call(api.GET('/auth/session'))
      .then(({ role, suspendedUntil }) => {
        setSession({ status: 'active', role, suspendedUntil });
      })
      .catch((error: unknown) => {
        // Solo un 401 dice que no hay sesión; sin red no se sabe.
        const anonymous = error instanceof ApiError && error.status === 401;
        setSession(anonymous ? { status: 'anonymous' } : { status: 'unknown', error });
      });
  }, [attempt]);

  const value = useMemo(
    () => ({
      session,
      signOut: async () => {
        await call(api.POST('/auth/logout'));
        setSession({ status: 'anonymous' });
      },
      reload: () => {
        setSession({ status: 'loading' });
        setAttempt((current) => current + 1);
      },
    }),
    [session],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
