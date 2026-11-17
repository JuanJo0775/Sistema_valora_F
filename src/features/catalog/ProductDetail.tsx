import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatPresentation } from './presentation';
import { useSession } from '../auth/session';
import { AddToBasket } from '../basket/AddToBasket';
import { CheapestOffers } from '../comparison/CheapestOffers';
import { HistorySummary } from '../history/HistorySummary';
import { ChangeProductPhoto } from '../moderation/ChangeProductPhoto';
import { ProductImage } from './ProductImage';
import './catalog.css';

type Product = components['schemas']['Product'];

// Resultado de la consulta, marcado con el producto que lo pidió.
type Outcome = { key: string; product: Product } | { key: string; error: unknown };

export function ProductDetail() {
  const { productId = '' } = useParams();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  // La foto que acaba de subir un moderador, sin volver a pedir el producto. Va con su producto:
  // al pasar a otro, no se arrastra.
  const [uploaded, setUploaded] = useState<{ productId: string; image: Product['image'] } | null>(
    null,
  );
  const { session } = useSession();
  const key = `${productId}|${String(attempt)}`;

  useEffect(() => {
    let current = true;
    call(api.GET('/products/{productId}', { params: { path: { productId } } }))
      .then((product) => {
        if (current) setOutcome({ key, product });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [productId, key]);

  const result = outcome?.key === key ? outcome : null;
  if (result && 'error' in result && !isNotFound(result.error)) {
    return (
      <ErrorState
        error={result.error}
        onRetry={() => {
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  if (result && 'error' in result) {
    return (
      <EmptyState
        title="No encontramos este producto"
        action={
          <Link to="/" className="btn ghost">
            Buscar otro producto
          </Link>
        }
      />
    );
  }
  if (!result) return <Loading />;
  const product =
    uploaded?.productId === productId
      ? { ...result.product, image: uploaded.image }
      : result.product;
  const moderator = session.status === 'active' && session.role === 'moderador';
  return (
    <div className="with-side">
      <article className="detail">
        <ProductImage name={product.name} image={product.image} />
        {/* #58: solo un moderador cambia la foto (en el Corte 2, fotos del equipo, ADR-020). */}
        {moderator && (
          <ChangeProductPhoto
            productId={product.id}
            onChanged={(image) => {
              setUploaded({ productId: product.id, image });
            }}
          />
        )}
        <h1>{product.name}</h1>
        <p className="muted">
          {[product.brand, product.category.name].filter(Boolean).join(' · ')}
        </p>
        <h2 id="presentaciones">Presentaciones</h2>
        <ul aria-labelledby="presentaciones" className="chips">
          {product.presentations.map((presentation) => (
            <li key={presentation.id} className="pill mute">
              {formatPresentation(presentation)}
            </li>
          ))}
        </ul>
      </article>
      {/* #48: en escritorio, el panel fijo de la derecha; en el celular, debajo del producto. */}
      <aside className="side" aria-label="Precios y acciones">
        <CheapestOffers product={product} />
        <AddToBasket product={product} />
        <HistorySummary productId={product.id} />
        {/* Prototipo: la acción principal (naranja) es comparar; las demás, secundarias. */}
        <div className="actions">
          <Link to={`/productos/${product.id}/comparar`} className="btn">
            Comparar precios
          </Link>
          <Link to={`/productos/${product.id}/historial`} className="btn ghost">
            Historial
          </Link>
          <Link to={`/registrar?producto=${product.id}`} className="btn ghost">
            Registrar un precio
          </Link>
        </div>
      </aside>
    </div>
  );
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
