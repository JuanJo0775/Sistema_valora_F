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
