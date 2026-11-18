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
