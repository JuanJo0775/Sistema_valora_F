const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Fechas de calendario de Colombia (AAAA-MM-DD) que manda el backend: se leen tal cual, sin zona
// horaria, para que ningún teléfono corra el día. «2026-11-14» → «14 nov».
export function shortDay(date: string): string {
  const [, month = '1', day = '1'] = date.split('-');
  return `${String(Number(day))} ${MONTHS[Number(month) - 1] ?? ''}`;
}

const BOGOTA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

// Un instante (fecha y hora) como día de calendario en Colombia: «2026-11-16T15:00:00Z» → «16 nov».
export const dayInColombia = (instant: string) => shortDay(BOGOTA_DAY.format(new Date(instant)));

const DAY_MS = 24 * 60 * 60 * 1000;

// Cuántos días de calendario en Colombia pasaron desde un instante: «hoy» y «ayer» se cuentan con
// la hora del Quindío, no con la del teléfono.
export function daysAgo(instant: string, now = new Date()): number {
  const day = (date: Date) => Date.parse(BOGOTA_DAY.format(date));
  return Math.round((day(now) - day(new Date(instant))) / DAY_MS);
}

// «Hoy», «Ayer» o «Hace 3 días».
export function relativeDay(instant: string, now = new Date()): string {
  const days = daysAgo(instant, now);
  return days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${String(days)} días`;
}
