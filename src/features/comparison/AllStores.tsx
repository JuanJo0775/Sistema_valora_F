import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useOnline } from '../../shared/ui/offline';
import { OfflineMessage } from '../../shared/ui/OfflineMessage';
import { SkeletonList } from '../../shared/ui/Skeleton';
import { formatPresentation } from '../catalog/presentation';
import { describeCriteria, MUNICIPALITIES } from './criteria';
import { ago, comparisonKey, readComparison, saveComparison } from './lastComparison';
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
  onFailed,
}: {
  product: Product;
  onComparison?: (comparison: Comparison) => void;
  // La consulta falló: el detalle deja de reservar el lugar de la tarjeta «Más barato».
  onFailed?: () => void;
}) {
  const [chosenSort, setSort] = useState<Sort>('unit_price');
  // «Más cerca» sin ubicación la pide; cuando llega, ordena por distancia. Si no llega, el orden
  // anterior se queda y se avisa (nunca un botón mudo).
  const [wantsDistance, setWantsDistance] = useState(false);
  // Por defecto el último municipio, sin pedir permisos; con la ubicación, las tiendas cercanas
  // (EC-08: la ubicación solo va en la consulta y no se guarda).
  const where = useWhere();
  const { point } = where;
  const sort: Sort = wantsDistance && point ? 'distance' : chosenSort;
  const distanceDenied = wantsDistance && !point && where.problem !== '';
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  // Cada respuesta guarda la consulta que la pidió: una lenta no pisa a una más nueva.
  const [outcome, setOutcome] = useState<
    // savedAt: sin conexión, la última comparación vista (H-08), no una nueva.
    | { key: string; comparison: Comparison; savedAt?: number }
    | { key: string; error: unknown }
    | null
  >(null);
  const online = useOnline();
  const [attempt, setAttempt] = useState(0);
  const productId = product.id;
  // El último onComparison, sin volver a pedir la comparación cada vez que cambia.
  const notify = useRef(onComparison);
  const notifyFailed = useRef(onFailed);
  useEffect(() => {
    notify.current = onComparison;
    notifyFailed.current = onFailed;
  }, [onComparison, onFailed]);
  const key = `${String(attempt)}|${productId}|${sort}|${String(onlyCurrent)}|${where.key}`;
  // Solo se guarda lo pedido por municipio, nunca con la ubicación (EC-08).
  const savedKey = comparisonKey({
    productId,
    located: point !== null,
    where: where.key,
    sort,
    onlyCurrent,
  });

  useEffect(() => {
    if (!where.ready) return;
    let current = true;
    call(
      api.GET('/products/{productId}/comparison', {
        params: { path: { productId }, query: { ...where.query, sort, onlyCurrent } },
      }),
    )
      .then((comparison) => {
        if (!current) return;
        saveComparison(savedKey, comparison);
        setOutcome({ key, comparison });
        notify.current?.(comparison);
      })
      .catch((error: unknown) => {
        if (!current) return;
        // Sin red, lo último que se vio de este producto en este municipio.
        const last =
          error instanceof ApiError && error.status === 0 ? readComparison(savedKey) : null;
        if (last) {
          setOutcome({ key, comparison: last.comparison, savedAt: last.savedAt });
          notify.current?.(last.comparison);
          return;
        }
        setOutcome({ key, error });
        notifyFailed.current?.();
      });
    return () => {
      current = false;
    };
  }, [where.ready, productId, sort, where.query, onlyCurrent, key, savedKey]);

  // Mostrando lo último que se vio: al volver la conexión se pide la comparación al día.
  const showingSaved = outcome?.key === key && 'savedAt' in outcome;
  useEffect(() => {
    if (!showingSaved) return;
    const refresh = () => {
      setAttempt((current) => current + 1);
    };
    window.addEventListener('online', refresh, { once: true });
    return () => {
      window.removeEventListener('online', refresh);
    };
  }, [showingSaved]);

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
            setWantsDistance(false);
            if (chosenSort === 'distance') setSort('unit_price');
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
              onChange={() => {
                if (option.value === 'distance' && !point) {
                  // Sin la ubicación no hay distancia (el backend responde 400): se pide.
                  setWantsDistance(true);
                  where.locateMe();
                  return;
                }
                setWantsDistance(false);
                setSort(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
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
      {wantsDistance && !point && !where.problem && (
        <p role="status" className="muted">
          Buscando tu ubicación para ordenar por distancia…
        </p>
      )}
      {distanceDenied && (
        <p role="alert" className="banner warn">
          Activa la ubicación del navegador para ordenar por distancia.
        </p>
      )}
      {!result && <SkeletonList kind="offer" />}
      {result && 'error' in result && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((current) => current + 1);
          }}
        />
      )}
      {result && 'comparison' in result && result.savedAt !== undefined && (
        <SavedNotice
          savedAt={result.savedAt}
          online={online}
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
    </section>
  );
}

// H-08: se muestra lo último que se vio. Sin red es el único mensaje de la pantalla; con red (el
// servidor no contestó) se ofrece reintentar.
function SavedNotice({
  savedAt,
  online,
  onRetry,
}: {
  savedAt: number;
  online: boolean;
  onRetry: () => void;
}) {
  const when = `(${ago(savedAt)}). Los precios pueden haber cambiado.`;
  if (!online) {
    return (
      <OfflineMessage>{`Sin conexión: te mostramos lo último que viste ${when}`}</OfflineMessage>
    );
  }
  return (
    <p role="status" className="banner warn">
      {`No pudimos actualizar: te mostramos lo último que viste ${when} `}
      <button type="button" className="link-button" onClick={onRetry}>
        Reintentar
      </button>
    </p>
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
  // Cuántas filas llevan el mismo nombre de tienda (cadenas con varias sedes).
  const names = new Map<string, number>();
  for (const { establishment } of results) {
    const name = establishment.name.toLowerCase();
    names.set(name, (names.get(name) ?? 0) + 1);
  }
  const others = results.filter((offer) => !competes(offer));
  return (
    <>
      <p className="muted">
        <span>{describeCriteria(criteria)}</span>. Ningún comercio paga por aparecer primero.
        {criteria.sort === 'unit_price' && (
          <>
            {' '}
            <span>
              Se ordena por lo que cuesta cada 100 g, 100 ml o unidad; el precio grande es el total
              de la presentación.
            </span>
          </>
        )}
      </p>
      {results.some(needsHelp) && <LabelsHelp />}
      <ol className="offer-list">
        {competing.map((offer, index) => (
          <Offer
            key={offer.reportId}
            offer={offer}
            size={sizeOf(offer.presentationId)}
            rank={rankOf(competing, index, criteria.sort)}
            sameName={names.get(offer.establishment.name.toLowerCase()) !== 1}
          />
        ))}
      </ol>
      {others.length > 0 && (
        <>
          <h3>Precios viejos o en revisión</h3>
          <ul className="offer-list">
            {others.map((offer) => (
              <Offer
                key={offer.reportId}
                offer={offer}
                size={sizeOf(offer.presentationId)}
                sameName={names.get(offer.establishment.name.toLowerCase()) !== 1}
              />
            ))}
          </ul>
        </>
      )}
      {reference}
    </>
  );
}

// Solo los datos iniciales y la confiabilidad baja necesitan explicación.
const needsHelp = (offer: Comparison['results'][number]) =>
  offer.source === 'siembra' || offer.reliability === 'baja';

// Con el orden por precio por unidad, las filas con el mismo precio por unidad comparten lugar
// («1, 1, 1, 4»): un empate no son posiciones distintas. Los otros órdenes numeran la posición.
// El orden de las filas lo da el backend; aquí solo se numera.
function rankOf(rows: Comparison['results'], index: number, sort: Sort): number {
  if (sort !== 'unit_price') return index + 1;
  const value = rows[index]?.unitPrice.valueCop;
  return rows.findIndex(({ unitPrice }) => unitPrice.valueCop === value) + 1;
}

// Un `details` nativo: se abre con toque, Enter o Espacio, y su nombre es su resumen.
function LabelsHelp() {
  return (
    <details className="labels-help">
      <summary>¿Qué significan estas etiquetas?</summary>
      <p>
        <strong>Dato inicial</strong>: precio de referencia que cargó Valora para arrancar; todavía
        ninguna persona de la comunidad lo ha confirmado.
      </p>
      <p>
        <strong>Confiabilidad baja</strong>: lo vio una sola persona o no se ha confirmado. Sube
        cuando otras personas lo confirman; tú también puedes hacerlo registrando el precio que ves.
      </p>
    </details>
  );
}
