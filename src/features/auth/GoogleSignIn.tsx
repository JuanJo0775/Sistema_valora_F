// ADR-029, fase 2 (F#154): un enlace normal y no el Link del router, porque el navegador debe salir de
// la PWA hacia el servidor (/v1/* va a la API), que lo lleva a Google y lo trae de vuelta. Sin el
// JavaScript de Google: nada de terceros se carga en la página (EC-08).
export const GOOGLE_START = '/v1/auth/google/start';

export function GoogleSignIn() {
  return (
    <a className="btn ghost" href={GOOGLE_START}>
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
    'Tu cuenta está programada para eliminarse. Si tiene contraseña, entra con tu correo y contraseña para restaurarla.',
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
