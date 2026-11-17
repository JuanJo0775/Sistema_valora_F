import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatPresentation } from '../catalog/presentation';
import { describeCriteria, MUNICIPALITIES } from './criteria';
import { Offer } from './Offer';
import { useWhere } from './WhereChooser';
import { WhereChip } from './WhereChip';
import { WholesaleReference } from './WholesaleReference';
import './comparison.css';

type Product = components['schemas']['Product'];
export type Comparison = components['schemas']['Comparison'];
type Sort = Comparison['criteria']['sort'];

// Prototipo: control segmentado. Los nombres dicen qué se ve primero.
const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'unit_price', label: 'Más barato' },
  { value: 'distance', label: 'Más cerca' },
  { value: 'recent', label: 'Más reciente' },
];

// Los que el backend pone al final: no compiten en el orden (RF-010, RF-012).
export const competes = (offer: Comparison['results'][number]) =>
  offer.freshness !== 'desactualizado' && offer.reliability !== 'en_revision';

// #65 (P7, EC-06): todas las tiendas con precio del producto, dentro de su detalle. El orden lo
// decide el backend con el criterio declarado; la pantalla no reordena ni destaca a nadie más que
// a lo que el backend marca. Cada comparación nueva se avisa con onComparison (el panel del
// detalle muestra el más barato).
export function AllStores({
  product,
  onComparison,
}: {
  product: Product;
  onComparison?: (comparison: Comparison) => void;
}) {
  const [sort, setSort] = useState<Sort>('unit_price');
  // Por defecto el último municipio, sin pedir permisos; con la ubicación, las tiendas cercanas
  // (EC-08: la ubicación solo va en la consulta y no se guarda).
  const where = useWhere();
  const { point } = where;
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  // Cada respuesta guarda la consulta que la pidió: una lenta no pisa a una más nueva.
  const [outcome, setOutcome] = useState<
    { key: string; comparison: Comparison } | { key: string; error: unknown } | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const productId = product.id;
  // El último onComparison, sin volver a pedir la comparación cada vez que cambia.
  const notify = useRef(onComparison);
  useEffect(() => {
    notify.current = onComparison;
  }, [onComparison]);
  const key = `${String(attempt)}|${productId}|${sort}|${String(onlyCurrent)}|${where.key}`;

  useEffect(() => {
    let current = true;
    call(
      api.GET('/products/{productId}/comparison', {
        params: { path: { productId }, query: { ...where.query, sort, onlyCurrent } },
      }),
    )
      .then((comparison) => {
        if (!current) return;
        setOutcome({ key, comparison });
        notify.current?.(comparison);
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [productId, sort, where.query, onlyCurrent, key]);

  const result = outcome?.key === key ? outcome : null;
  const sizeOf = (presentationId: string) => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    return presentation ? formatPresentation(presentation) : '';
  };
  return (
    <section className="all-stores" aria-labelledby="todas-las-tiendas">
      <div className="all-stores-head">
        <h2 id="todas-las-tiendas" className="eyebrow">
          Todas las tiendas
        </h2>
        <WhereChip
          where={where}
          backLabel="Comparar por municipio"
          onLeaveLocation={() => {
            // Sin ubicación no hay distancia: el backend responde 400 a sort=distance.
            if (sort === 'distance') setSort('unit_price');
          }}
        />
      </div>
      <fieldset role="radiogroup" className="segmented">
        <legend className="sr-only">Ordenar por</legend>
        {SORT_OPTIONS.map((option) => (
          <label key={option.value} className="segment">
            <input
              type="radio"
              name="sort"
              value={option.value}
              checked={sort === option.value}
              // Sin la ubicación no hay distancia: el backend responde 400 a sort=distance.
              disabled={option.value === 'distance' && !point}
              onChange={() => {
                setSort(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {!result && <Loading />}
      {result && 'error' in result && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((current) => current + 1);
          }}
        />
      )}
      {result && 'comparison' in result && (
        <Results
          comparison={result.comparison}
          sizeOf={sizeOf}
          register={`/registrar?producto=${productId}`}
        />
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={onlyCurrent}
          onChange={(event) => {
            setOnlyCurrent(event.target.checked);
          }}
        />
        Solo precios vigentes
      </label>
    </section>
  );
}

function Results({
  comparison,
  sizeOf,
  register,
}: {
  comparison: Comparison;
  sizeOf: (presentationId: string) => string;
  register: string;
}) {
  const { criteria, results, wholesaleReference } = comparison;
  const reference = wholesaleReference && <WholesaleReference reference={wholesaleReference} />;
  if (results.length === 0) {
    const where = criteria.municipality
      ? `en ${MUNICIPALITIES[criteria.municipality]}`
      : 'cerca de ti';
    return (
      <>
        <EmptyState
          title={`Todavía nadie ha reportado este producto ${where}`}
          action={
            <Link to={register} className="btn">
              Registrar un precio
            </Link>
          }
        />
        {reference}
      </>
    );
  }
  const competing = results.filter(competes);
  const others = results.filter((offer) => !competes(offer));
  return (
    <>
      <p className="muted">
        <span>{describeCriteria(criteria)}</span>. Ningún comercio paga por aparecer primero.
      </p>
      <ol className="offer-list">
        {competing.map((offer, index) => (
          <Offer
            key={offer.reportId}
            offer={offer}
            size={sizeOf(offer.presentationId)}
            rank={index + 1}
          />
        ))}
      </ol>
      {others.length > 0 && (
        <>
          <h3>Precios viejos o en revisión</h3>
          <ul className="offer-list">
            {others.map((offer) => (
              <Offer key={offer.reportId} offer={offer} size={sizeOf(offer.presentationId)} />
            ))}
          </ul>
        </>
      )}
      {reference}
    </>
  );
}
