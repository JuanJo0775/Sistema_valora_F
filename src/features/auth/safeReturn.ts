// Solo rutas de la misma app: un enlace «/entrar?volver=//otro.sitio» no saca a nadie de Valora.
// El navegador lee «/\» igual que «//» (otro sitio).
export function safeReturn(path: string | null): string {
  return path && /^\/(?![/\\])/.test(path) ? path : '/';
}
