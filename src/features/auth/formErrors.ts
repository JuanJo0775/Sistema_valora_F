import { type RefObject, useEffect } from 'react';

// Tras un intento de envío con errores, lleva el foco al primer campo marcado como inválido.
// `attempt` cambia en cada intento, así el foco vuelve aunque el mensaje sea el mismo.
export function useFocusFirstInvalid(form: RefObject<HTMLFormElement | null>, attempt: number) {
  useEffect(() => {
    if (attempt === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form, attempt]);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(email: string): string {
  const value = email.trim();
  if (!value) return 'Escribe tu correo.';
  if (!EMAIL.test(value)) return 'Escribe un correo válido, por ejemplo nombre@correo.co.';
  return '';
}

// B#133: letras (con tildes y ñ) y, entre palabras, un espacio, apóstrofo o guion. La misma regla que
// el servidor; aquí solo se dice antes de enviar.
const NAME = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

export function nameProblem(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40 || !NAME.test(trimmed)) {
    return 'Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.';
  }
  return '';
}

// Ley 1581: sin consentimiento no se crea la cuenta.
export const POLICY_REQUIRED =
  'Para crear la cuenta debes aceptar la política de tratamiento de datos.';
