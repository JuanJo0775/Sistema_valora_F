/**
 * Nombre de una presentación calculado por el servidor (H3): «Arroz blanco Diana · 1 kg».
 * Devuelve `undefined` si el backend aún no manda los campos, para que el portal use su respaldo.
 */
export function serverName(item: {
  productName?: string | undefined;
  presentationLabel?: string | undefined;
}): string | undefined {
  const name = item.productName?.trim();
  if (!name) return undefined;
  const label = item.presentationLabel?.trim();
  return label ? `${name} · ${label}` : name;
}
