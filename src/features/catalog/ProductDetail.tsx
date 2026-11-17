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
import { AllStores, type Comparison, competes } from '../comparison/AllStores';
import { CheapestCard } from '../comparison/CheapestCard';
import { MUNICIPALITIES } from '../comparison/criteria';
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
  // La última comparación de «Todas las tiendas»: el panel muestra su más barato.
  const [compared, setCompared] = useState<{ productId: string; comparison: Comparison } | null>(
    null,
  );
  const comparison = compared?.productId === productId ? compared.comparison : null;
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
        <p className="eyebrow">{product.category.name}</p>
        <h1>{product.name}</h1>
        {product.brand && <p className="muted">{product.brand}</p>}
        <p className="muted">{summary(product, comparison)}</p>
        <AllStores
          product={product}
          onComparison={(latest) => {
            setCompared({ productId: product.id, comparison: latest });
          }}
        />
      </article>
      {/* #48: en escritorio, el panel fijo de la derecha; en el celular, debajo del producto. */}
      <aside className="side" aria-label="Precios y acciones">
        {comparison && <CheapestCard comparison={comparison} sizeOf={sizeOf(product)} />}
        <HistorySummary productId={product.id} />
        {/* Prototipo: la acción principal (naranja) es registrar un precio de este producto. */}
        <Link to={`/registrar?producto=${product.id}`} className="btn">
          {`Registrar un precio de ${product.name}`}
        </Link>
        <AddToBasket product={product} />
      </aside>
    </div>
  );
}

const sizeOf = (product: Product) => (presentationId: string) => {
  const presentation = product.presentations.find(({ id }) => id === presentationId);
  return presentation ? formatPresentation(presentation) : '';
};

// «500 g, 1 kg · 6 tiendas en Armenia»: las presentaciones y cuántas tiendas tienen un precio que
// compite (vigente y no en revisión), de la última comparación.
function summary(product: Product, comparison: Comparison | null): string {
  const sizes = product.presentations.map(formatPresentation).join(', ');
  if (!comparison || comparison.results.length === 0) return sizes;
  const stores = new Set(
    comparison.results.filter(competes).map(({ establishment }) => establishment.id),
  ).size;
  const { municipality } = comparison.criteria;
  const where = municipality ? `en ${MUNICIPALITIES[municipality]}` : 'cerca';
  return `${sizes} · ${String(stores)} ${stores === 1 ? 'tienda' : 'tiendas'} ${where}`;
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;
