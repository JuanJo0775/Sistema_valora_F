import { useId } from 'react';
import type { components } from '../../shared/api/schema';
import { formatCop } from '../../shared/money';
import { formatPresentation } from './presentation';
import { useOnlineOffers } from './useOnlineOffers';

const observedDate = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeZone: 'America/Bogota',
});

export function ProductOnlineOffers({ product }: { product: components['schemas']['Product'] }) {
  const headingId = useId();
  const offers = useOnlineOffers(product.id);
  if (offers.status !== 'ready' || offers.items.length === 0) return null;

  return (
    <section className="product-online-offers" aria-labelledby={headingId}>
      <h2 id={headingId}>Olímpica en línea · Armenia centro</h2>
      <ul>
        {offers.items.map((offer) => {
          const presentation = product.presentations.find(({ id }) => id === offer.presentationId);
          if (!presentation) return null;
          return (
            <li key={offer.presentationId}>
              <span>{formatPresentation(presentation)}</span>
              <strong>{formatCop(offer.priceCop)}</strong>
              <p className="muted">
                Precio consultado el{' '}
                <time dateTime={offer.observedAt}>
                  {observedDate.format(new Date(offer.observedAt))}
                </time>
              </p>
              {offer.productUrl?.startsWith('https://www.olimpica.com/') && (
                <a href={offer.productUrl}>Ver en Olímpica</a>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted">Envío se calcula en Olímpica</p>
    </section>
  );
}
