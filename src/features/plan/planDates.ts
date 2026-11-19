// Fechas del plan según el día en Colombia (no el de la máquina ni el de UTC).
const SHORT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});
const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Bogota',
});

// «17 nov»; null si la fecha no es válida.
export function shortDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = SHORT.formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value.replace('.', '') ?? '';
  return `${part('day')} ${part('month')}`;
}

// «2026-11-17», para el nombre del archivo.
export const isoDay = (iso: string): string => ISO_DAY.format(new Date(iso));
