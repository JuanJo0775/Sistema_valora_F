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
