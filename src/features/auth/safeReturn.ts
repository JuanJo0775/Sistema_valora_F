// Solo rutas de la misma app: un enlace «/entrar?volver=//otro.sitio» no saca a nadie de Valora.
// El navegador lee «/\» igual que «//» (otro sitio).
export function safeReturn(path: string | null): string {
  return path && /^\/(?![/\\])/.test(path) ? path : '/';
}

// Enlace a otra pantalla de la cuenta que conserva a dónde volver después.
export const withReturn = (path: string, volver: string) =>
  `${path}?${new URLSearchParams({ volver }).toString()}`;
