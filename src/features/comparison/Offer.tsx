import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatDistance } from '../../shared/location';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { FlagPrice } from '../contributions/FlagPrice';

type Item = components['schemas']['ComparisonItem'];

// Hoy todo es de la comunidad; «oficial» llega con el módulo comercial (Corte 3).
const SOURCE: Record<Item['source'], string> = {
  comunidad: 'Comunidad',
  oficial: 'Precio oficial',
  siembra: 'Dato inicial',
};

// Un renglón de «Todas las tiendas» (prototipo): su lugar en el orden que declaró el backend, la
// tienda, su distancia y vigencia, y a la derecha el precio y el precio por unidad.
export function Offer({ offer, size, rank }: { offer: Item; size: string; rank?: number }) {
  return (
    <li className="offer-row">
      {rank !== undefined && (
        <span className={offer.isCheapest ? 'rank first' : 'rank'} aria-hidden="true">
          {rank}
        </span>
      )}
      <div className="offer-store">
        <h3>
          <Link to={`/tiendas/${offer.establishment.id}`}>{offer.establishment.name}</Link>
        </h3>
        {/* El primer lugar se ve en naranja; quien no ve el color lo oye. */}
        {offer.isCheapest && <span className="sr-only">Más barato</span>}
        <p className="muted offer-meta">
          {offer.establishment.distanceM !== undefined && (
            <span>{formatDistance(offer.establishment.distanceM)}</span>
          )}
          <FreshnessBadge freshness={offer.freshness} observedAt={offer.observedAt} />
          <ReliabilityBadge level={offer.reliability} />
          <span className="pill mute">{SOURCE[offer.source]}</span>
        </p>
        <p className="offer-links">
          <a
            href={directionsTo(offer.establishment)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Cómo llegar a ${offer.establishment.name}`}
          >
            Cómo llegar
          </a>
          <FlagPrice reportId={offer.reportId} storeName={offer.establishment.name} />
        </p>
      </div>
      <div className="offer-price">
        <strong>{formatCop(offer.priceCop)}</strong>
        <span className="muted">{`${size} · ${formatUnitPrice(offer.unitPrice)}`}</span>
      </div>
    </li>
  );
}
