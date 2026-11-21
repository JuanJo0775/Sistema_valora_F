// «18 de diciembre de 2026, 3:30 p. m.», en la hora local del dispositivo.
export function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'la fecha indicada';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}
