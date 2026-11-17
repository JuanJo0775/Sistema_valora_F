// El precio como lo escribe la gente: «4600», «4.600», «$4.600», «1490,00». En Colombia el punto
// separa los miles y la coma, los decimales. El contrato recibe pesos enteros (sin centavos).
const MAX_PRICE = 10_000_000;

export function parsePrice(text: string): { pesos: number } | { problem: string } {
  const typed = text.replace(/[$\s]/g, '');
  if (!typed) return { problem: 'Escribe el precio en pesos.' };
  const match = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(typed);
  if (!match?.[1]) {
    return { problem: 'Escribe solo números, por ejemplo 4600 o $4.600.' };
  }
  if (match[2] && Number(match[2]) !== 0) {
    return { problem: 'Escribe el precio en pesos enteros, sin centavos.' };
  }
  const pesos = Number(match[1].replace(/[.,]/g, ''));
  if (pesos < 1) return { problem: 'El precio debe ser mayor que 0.' };
  if (pesos > MAX_PRICE) return { problem: 'El precio no puede pasar de $10.000.000.' };
  return { pesos };
}
