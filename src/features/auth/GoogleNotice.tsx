import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

// Códigos con los que el servidor devuelve a /entrar y /crear-cuenta tras Google (?google=).
const MESSAGES = {
  cancelado:
    'Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo o usar tu correo.',
  fallo: 'No pudimos iniciar sesión con Google. Intenta de nuevo en un momento o usa tu correo.',
  suspendida: 'Esta cuenta está suspendida.',
  consentimiento: 'Para crear tu cuenta con Google, acepta la política de datos',
} as const;

export type GoogleCode = keyof typeof MESSAGES;

const isCode = (value: string | null): value is GoogleCode =>
  value !== null && Object.hasOwn(MESSAGES, value);

// Lee ?google=<código> una vez, lo recuerda y lo quita de la dirección sin recargar. Un código
// desconocido se ignora (y también se quita).
export function useGoogleNotice(): GoogleCode | null {
  const [params, setParams] = useSearchParams();
  const raw = params.get('google');
  const [code, setCode] = useState<GoogleCode | null>(isCode(raw) ? raw : null);

  useEffect(() => {
    if (raw === null) return;
    if (isCode(raw)) setCode(raw);
    const rest = new URLSearchParams(params);
    rest.delete('google');
    setParams(rest, { replace: true });
  }, [raw, params, setParams]);

  return code;
}

// El aviso es una región role="alert" y recibe el foco al aparecer.
export function GoogleNotice({ code, id }: { code: GoogleCode; id?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [code]);
  return (
    <p ref={ref} id={id} role="alert" tabIndex={-1} className="banner warn">
      {MESSAGES[code]}
    </p>
  );
}
