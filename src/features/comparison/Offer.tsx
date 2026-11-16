import type { components } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { formatCop, formatUnitPrice } from '../../shared/money';

type Item = components['schemas']['ComparisonItem'];

// Hoy todo es de la comunidad; «oficial» llega con el módulo comercial (Corte 3).
const SOURCE: Record<Item['source'], string> = {
  comunidad: 'Comunidad',
  oficial: 'Precio oficial',
  siembra: 'Dato inicial',
};

const directions = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1',
    destination: `${String(lat)},${String(lng)}`,
  }).toString()}`;

// Un precio de la comparación: tienda, presentación, precio por unidad y qué tan confiable es.
export function Offer({ offer, size }: { offer: Item; size: string }) {
  return (
    <li className="offer">
      <h3>{offer.establishment.name}</h3>
      {offer.establishment.distanceM !== undefined && (
        <p className="muted">{formatDistance(offer.establishment.distanceM)}</p>
      )}
      <p>
        {size} · {formatCop(offer.priceCop)}
      </p>
      <p className="unit">{formatUnitPrice(offer.unitPrice)}</p>
      <p className="badges">
        {offer.isCheapest && <span className="pill ok">Más barato</span>}
        <FreshnessBadge freshness={offer.freshness} observedAt={offer.observedAt} />
        <ReliabilityBadge level={offer.reliability} />
        <span className="pill mute">{SOURCE[offer.source]}</span>
      </p>
      {/* ADR-019: el mapa es OpenStreetMap; Google solo como enlace externo. Solo va la tienda. */}
      <a
        href={directions(offer.establishment)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Cómo llegar a ${offer.establishment.name}`}
      >
        Cómo llegar
      </a>
    </li>
  );
}
