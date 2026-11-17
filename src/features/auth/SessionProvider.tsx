import type { Middleware } from 'openapi-fetch';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { readLastRole, saveLastRole } from './lastRole';
import { type Session, SessionContext } from './session';

// ADR-014: la sesión es una cookie del servidor; la app pregunta quién es al abrirse.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    call(api.GET('/auth/session'))
      .then(({ role, suspendedUntil }) => {
        saveLastRole(role);
        setSession({ status: 'active', role, suspendedUntil });
      })
      .catch((error: unknown) => {
        // Solo un 401 dice que no hay sesión; sin red no se sabe.
        const anonymous = error instanceof ApiError && error.status === 401;
        if (anonymous) saveLastRole(null);
        setSession(
          anonymous
            ? { status: 'anonymous' }
            : { status: 'unknown', error, lastRole: readLastRole() },
        );
      });
  }, [attempt]);

  // Una sesión vencida o revocada responde 401 en cualquier ruta: la app la da por cerrada y las
  // secciones protegidas llevan a iniciar sesión (y luego de vuelta a donde estaba).
  useEffect(() => {
    const expired: Middleware = {
      onResponse({ response }) {
        if (response.status === 401) {
          saveLastRole(null);
          setSession({ status: 'anonymous' });
        }
        return response;
      },
    };
    api.use(expired);
    return () => {
      api.eject(expired);
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      // Iniciar sesión responde 204 con la cookie; el rol se vuelve a pedir a /auth/session.
      signIn: async (credentials: { email: string; password: string }) => {
        await call(api.POST('/auth/login', { body: credentials }));
        setSession({ status: 'loading' });
        setAttempt((current) => current + 1);
      },
      signOut: async () => {
        await call(api.POST('/auth/logout'));
        saveLastRole(null);
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
