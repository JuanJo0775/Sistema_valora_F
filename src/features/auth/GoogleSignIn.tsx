import { POLICY_VERSION } from '../legal/policy';

// ADR-029, fase 2 (F#154): un enlace normal y no el Link del router, porque el navegador debe salir de
// la PWA hacia el servidor (/v1/* va a la API), que lo lleva a Google y lo trae de vuelta. Sin el
// JavaScript de Google: nada de terceros se carga en la página (EC-08).
export const GOOGLE_START = '/v1/auth/google/start';

// Volver a entrar con Google para confirmar que es la misma persona (crear la contraseña desde
// Ajustes). Navegación completa; el servidor devuelve a `returnTo`, una ruta de la app.
export function googleReauthUrl(returnTo: string): string {
  return `${GOOGLE_START}?${new URLSearchParams({ acceptPolicy: POLICY_VERSION, returnTo }).toString()}`;
}

// La «G» de colores que pide Google en sus botones de inicio de sesión. Va dentro de la página (no se
// descarga de Google) y es decorativa: el nombre del botón lo da el texto.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function GoogleSignIn() {
  return (
    <a className="btn ghost" href={GOOGLE_START}>
      <GoogleLogo />
      Continuar con Google
    </a>
  );
}

// B#181: los motivos con los que el servidor vuelve de Google a /entrar?error=…. Solo textos propios:
// un código desconocido no muestra nada.
const GOOGLE_ERRORS: Record<string, string> = {
  google: 'No pudimos confirmar tu cuenta de Google. Inténtalo de nuevo.',
  'google-correo-sin-verificar':
    'Google no ha verificado ese correo. Verifícalo en Google o crea una cuenta con contraseña.',
  // B#188: restaurar con Google una cuenta sin contraseña llega después.
  'eliminacion-pendiente':
    'Tu cuenta está programada para eliminarse. Si tiene contraseña, entra con tu correo y contraseña para restaurarla. Si no, vuelve a entrar con Google durante los 10 días.',
};

export function GoogleError({ code }: { code: string | null }) {
  const message = code === null ? undefined : GOOGLE_ERRORS[code];
  if (!message) return null;
  return (
    <p className="banner" role="alert">
      {message}
    </p>
  );
}
