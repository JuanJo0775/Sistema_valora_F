import type { Middleware } from 'openapi-fetch';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { readLastRole, saveLastRole } from './lastRole';
import { type Role, type Session, SessionContext } from './session';

// MerchantVerified cambia el rol por el relé. El segundo reintento cubre el intervalo de 5 s.
async function loadSession(signal: AbortSignal, expectedRole?: Role) {
  let session = await call(api.GET('/auth/session', { signal }));
  for (
    let retries = 0;
    expectedRole && session.role !== expectedRole && retries < 2;
    retries += 1
  ) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, retries === 0 ? 600 : 4500));
    if (signal.aborted) return session;
    session = await call(api.GET('/auth/session', { signal }));
  }
  return session;
}

async function fetchSession(signal: AbortSignal, expectedRole?: Role) {
  const session = await loadSession(signal, expectedRole);
  // `suspension` es aditivo y el backend aún no lo declara en los tipos generados: se lee como opcional.
  const { suspension } = session as { suspension?: { reason?: string } };
  return { ...session, suspension };
}

// ADR-014: la sesión es una cookie del servidor; la app pregunta quién es al abrirse.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [attempt, setAttempt] = useState<{ expectedRole?: Role }>({});
  const request = useRef<AbortController>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    fetchSession(controller.signal, attempt.expectedRole)
      .then(
        ({
          role,
          suspendedUntil,
          suspension,
          displayName,
          emailVerified,
          emailVerificationRequired,
          hasPassword,
        }) => {
          if (controller.signal.aborted) return;
          saveLastRole(role);
          setSession({
            status: 'active',
            role,
            suspendedUntil,
            suspensionReason: suspension?.reason,
            displayName,
            emailVerified,
            emailVerificationRequired,
            hasPassword,
          });
        },
      )
      .catch((error: unknown) => {
        // Solo un 401 dice que no hay sesión; sin red no se sabe.
        const anonymous = error instanceof ApiError && error.status === 401;
        if (controller.signal.aborted || (attempt.expectedRole && !anonymous)) return;
        if (anonymous) saveLastRole(null);
        setSession(
          anonymous
            ? { status: 'anonymous' }
            : { status: 'unknown', error, lastRole: readLastRole() },
        );
      });
    return () => {
      controller.abort();
    };
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
        setAttempt({});
      },
      // Restaurar una cuenta en período de gracia: igual que iniciar sesión.
      restoreAccount: async (credentials: { email: string; password: string }) => {
        await call(api.POST('/auth/restore-account', { body: credentials }));
        setSession({ status: 'loading' });
        setAttempt({});
      },
      signOut: async () => {
        await call(api.POST('/auth/logout'));
        request.current?.abort();
        saveLastRole(null);
        setSession({ status: 'anonymous' });
      },
      endSession: () => {
        request.current?.abort();
        saveLastRole(null);
        setSession({ status: 'anonymous' });
      },
      passwordCreated: () => {
        setSession((now) => (now.status === 'active' ? { ...now, hasPassword: true } : now));
      },
      nameChanged: (displayName: string) => {
        setSession((now) => (now.status === 'active' ? { ...now, displayName } : now));
      },
      reload: () => {
        setSession({ status: 'loading' });
        setAttempt({});
      },
      refreshRole: (expectedRole: Role) => {
        setAttempt({ expectedRole });
      },
    }),
    [session],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
