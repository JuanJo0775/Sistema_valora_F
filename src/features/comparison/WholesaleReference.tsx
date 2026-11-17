import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';

type Reference = NonNullable<components['schemas']['Comparison']['wholesaleReference']>;

// Fechas de calendario (AAAA-MM-DD): se leen al mediodía UTC para que ninguna zona horaria cambie
// el día.
const day = (date: string) => new Date(`${date}T12:00:00Z`);
const LONG = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

// «del 2 al 8 de noviembre de 2026», o «del 30 de octubre al 5 de noviembre de 2026».
function period(start: string, end: string) {
  const [from, to] = [day(start), day(end)];
  const sameMonth =
    from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const first = sameMonth ? String(from.getUTCDate()) : DAY_MONTH.format(from);
  return `del ${first} al ${LONG.format(to)}`;
}

// RF-014 (RN3): precio mayorista público del DANE, aparte. Nunca es precio de una tienda, no entra
// al orden ni a «Más barato» (#16).
export function WholesaleReference({ reference }: { reference: Reference }) {
  return (
    <section aria-labelledby="referencia-mayorista" className="wholesale">
      <h2 id="referencia-mayorista">Referencia mayorista</h2>
      <p className="unit">{`${formatCop(reference.pricePerKgCop)} por kilo`}</p>
      <p>{`${reference.market} · ${period(reference.periodStart, reference.periodEnd)}`}</p>
      <p className="muted">
        {`${reference.source}. No es el precio de una tienda.`}{' '}
        <a href={reference.url} target="_blank" rel="noopener noreferrer">
          Ver el boletín
        </a>
      </p>
    </section>
  );
}
