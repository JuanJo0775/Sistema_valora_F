import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { directionsTo } from '../../shared/directions';
import { formatDistance } from '../../shared/location';
import { dayInColombia } from '../../shared/days';
import { FreshnessBadge } from '../../shared/ui/FreshnessBadge';
import { ReliabilityBadge } from '../../shared/ui/ReliabilityBadge';
import { formatCop, formatUnitPrice } from '../../shared/money';
import { FlagPrice } from '../contributions/FlagPrice';

type Item = components['schemas']['ComparisonItem'];

const SOURCE: Record<Item['source'], string> = {
  comunidad: 'Comunidad',
  oficial: 'Precio oficial',
  siembra: 'Dato inicial',
};

// Un renglón de «Todas las tiendas» (prototipo): su lugar en el orden que declaró el backend, la
// tienda, su distancia y vigencia, y a la derecha el precio y el precio por unidad.
export function Offer({
  offer,
  size,
  rank,
  sameName = false,
}: {
  offer: Item;
  size: string;
  rank?: number;
  // Hay otra tienda con este mismo nombre en la lista: sin dirección, se dice con qué se distingue.
  sameName?: boolean;
}) {
  const { address, distanceM } = offer.establishment;
  const { discrepancy } = offer;
  const homonym = sameName && !address;
  // Un dato inicial vigente no es «Hoy» en verde: es una referencia que aún nadie confirma. Si su
  // vigencia es de advertencia (por confirmar, desactualizado), esa advertencia se conserva.
  const neutralInitial = offer.source === 'siembra' && offer.freshness === 'vigente';
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
        {/* Dato que distingue tiendas con el mismo nombre; solo si la API lo trae. */}
        {address && <p className="muted offer-address">{address}</p>}
        {homonym && (
          <p className="muted offer-address">
            {distanceM === undefined
              ? 'Sin dirección registrada'
              : `Sin dirección registrada · a ${formatDistance(distanceM)}`}
          </p>
        )}
        {/* El primer lugar se ve en naranja; quien no ve el color lo oye. */}
        {offer.isCheapest && <span className="sr-only">Más barato</span>}
        <p className="muted offer-meta">
          {distanceM !== undefined && !homonym && <span>{formatDistance(distanceM)}</span>}
          {neutralInitial ? (
            <span className="pill mute">{`${SOURCE.siembra} · ${dayInColombia(offer.observedAt)}`}</span>
          ) : (
            <FreshnessBadge freshness={offer.freshness} observedAt={offer.observedAt} />
          )}
          <ReliabilityBadge level={offer.reliability} />
          {!neutralInitial && <span className="pill mute">{SOURCE[offer.source]}</span>}
        </p>
        {discrepancy && (
          <div className="offer-discrepancy">
            <p>
              <strong>Discrepancia corroborada</strong>
            </p>
            <p>{`Oficial ${formatCop(discrepancy.officialPriceCop)} · Reportado ${formatCop(discrepancy.reportedPriceCop)}`}</p>
            <p>{`${String(discrepancy.reports)} reportes desde el ${dayInColombia(discrepancy.since)}`}</p>
          </div>
        )}
        <p className="offer-links">
          <a
            href={directionsTo(offer.establishment)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Cómo llegar a ${offer.establishment.name}`}
          >
            Cómo llegar
          </a>
          {/* ADR-028: solo un precio de la comunidad es un reporte y puede marcarse. Un dato inicial
              (siembra) trae un id que no existe como reporte y marcarlo responde 404. */}
          {offer.source === 'comunidad' && offer.reportId && (
            <FlagPrice reportId={offer.reportId} storeName={offer.establishment.name} />
          )}
        </p>
      </div>
      <div className="offer-price">
        <strong>{formatCop(offer.priceCop)}</strong>
        <span className="muted">{`${size} · ${formatUnitPrice(offer.unitPrice)}`}</span>
      </div>
    </li>
  );
}
