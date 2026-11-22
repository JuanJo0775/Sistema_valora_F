import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components, operations } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { ChipRow } from '../../shared/ui/ChipRow';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonCard, SkeletonList } from '../../shared/ui/Skeleton';
import { useBasket } from '../basket/basketContext';
import { ProductThumb } from '../catalog/ProductThumb';
import '../catalog/catalog.css';
import { MUNICIPALITIES } from './criteria';
import { useWhere } from './useWhere';
import { WherePicker } from './WherePicker';
import './comparison.css';

type Featured = operations['listFeaturedProducts']['responses'][200]['content']['application/json'];
type Item = Featured['items'][number];
type Category = components['schemas']['Category'];

// Primera carga: 6 en el celular, 12 en pantallas anchas. Cada «Ver más» pide 12: desde 6, los
// totales (6, 18, 30…) y desde 12 (12, 24, 36…) son múltiplos de 1, 2, 3 y 6 columnas, así la
// última fila de la cuadrícula siempre queda completa.
const FEW = 6;
const WIDE = 12;
const PAGE = 12;
const WIDE_QUERY = '(min-width: 900px)';
const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat('es-CO');

const firstSize = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(WIDE_QUERY).matches ? WIDE : FEW;

// «Precios de 7 tiendas en Armenia.»: el área la dice la respuesta, no lo que pidió la pantalla.
function area({ criteria, storesWithPrices }: Featured): string {
  const where =
    criteria.radiusKm === undefined
      ? `en ${criteria.municipality ? MUNICIPALITIES[criteria.municipality] : 'el Quindío'}`
      : `a menos de ${KM.format(criteria.radiusKm)} km de ti`;
  return `Precios de ${String(storesWithPrices)} ${storesWithPrices === 1 ? 'tienda' : 'tiendas'} ${where}.`;
}

// La etiqueta del backend es «Arroz Diana · 1 kg»: en la tarjeta el nombre ya está arriba.
const presentationOf = ({ label }: Item['cheapest']) => label.split(' · ').at(-1) ?? label;

// Lo acumulado de un mismo filtro (lugar y categoría): las páginas se suman sin repetir productos.
interface Shown {
  filter: string;
  // Criterio y tiendas de la primera página: lo que dice el encabezado.
  head: Featured;
  items: Item[];
  // Desde dónde pedir la página siguiente: lo que el servidor ya entregó, no lo que se ve.
  next: number;
  total?: number;
  hasMore: boolean;
}

// Con un servidor sin hasMore ni total todavía, se deduce: una página llena puede tener más.
function hasMoreAfter(page: Featured, offset: number, limit: number): boolean {
  if (page.hasMore !== undefined) return page.hasMore;
  if (page.total !== undefined) return offset + page.items.length < page.total;
  return page.items.length >= limit;
}

function accumulate(
  shown: Shown | null,
  page: Featured,
  filter: string,
  offset: number,
  limit: number,
): Shown {
  const known = shown?.filter === filter && offset > 0 ? shown : null;
  const seen = new Set(known?.items.map(({ productId }) => productId));
  const fresh = page.items.filter(({ productId }) => !seen.has(productId));
  return {
    filter,
    head: known?.head ?? page,
    // Las tarjetas ya mostradas conservan su objeto: React no las vuelve a pintar.
    items: known ? [...known.items, ...fresh] : fresh,
    next: offset + page.items.length,
    total: page.total ?? known?.total,
    // Una página sin nada nuevo (servidor que ignora offset) no puede tener «más».
    hasMore: hasMoreAfter(page, offset, limit) && (fresh.length > 0 || offset === 0),
  };
}

// #66 (prototipo, RF-008 y RF-009): la canasta básica del Inicio. Los productos con precio en más
// tiendas del municipio o de 1,5 km a la redonda, y el más bajo de cada uno. El orden, el precio
// y el ahorro los decide el backend (B#120, B#128); el criterio se dice en pantalla (EC-06).
// «Ver más» pide la página siguiente (offset) hasta que el servidor dice que no hay más.
export function TodayBasket() {
  const where = useWhere();
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [first] = useState(firstSize);
  const filter = `${where.key}|${category}`;
  // Desde dónde se pide: si cambia el lugar o la categoría, el filtro ya no coincide y vuelve a 0.
  const [from, setFrom] = useState({ filter, offset: 0 });
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<{ key: string; error?: unknown } | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  // Cuántos productos hay por filtro: se aprende de las respuestas que ya llegan, sin pedir más.
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [announce, setAnnounce] = useState('');
  const list = useRef<HTMLUListElement>(null);
  // Cuántas tarjetas había al pulsar «Ver más»: la primera nueva recibe el foco.
  const focusFrom = useRef<number | null>(null);
  const offset = from.filter === filter ? from.offset : 0;
  const limit = offset === 0 ? first : PAGE;
  const key = `${filter}|${String(offset)}|${String(attempt)}`;

  useEffect(() => {
    call(api.GET('/categories'))
      .then(({ items }) => {
        setCategories(items);
      })
      // Sin categorías, la canasta se ve igual, sin los chips.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!where.ready) return;
    let current = true;
    const query = {
      ...where.query,
      limit,
      ...(offset > 0 ? { offset } : {}),
      ...(category ? { category } : {}),
    };
    call(api.GET('/featured-products', { params: { query } }))
      .then((page) => {
        if (!current) return;
        setShown((before) => accumulate(before, page, filter, offset, limit));
        if (page.total !== undefined) {
          const known = page.total;
          setTotals((all) => ({ ...all, [filter]: known }));
        }
        setOutcome({ key });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [where.ready, where.query, category, limit, offset, key, filter]);

  const result = outcome?.key === key ? outcome : null;
  const current = shown?.filter === filter ? shown : null;
  const items = current?.items;
  const failed = result?.error !== undefined;
  const loadingMore = offset > 0 && !result;
  const moreFailed = offset > 0 && failed;
  const count = items?.length ?? 0;
  const total = current?.total;

  useEffect(() => {
    const before = focusFrom.current;
    if (before === null || !result) return;
    focusFrom.current = null;
    const added = count - before;
    if (added <= 0) return;
    setAnnounce(
      `Se cargaron ${String(added)} ${added === 1 ? 'producto más' : 'productos más'}${
        total === undefined ? '' : `. Mostrando ${String(count)} de ${String(total)}`
      }`,
    );
    // Sin scroll: la lista crece hacia abajo y lo que ya se veía no se mueve.
    const target = list.current?.querySelectorAll('a')[before] as HTMLElement | undefined;
    target?.focus({ preventScroll: true });
  }, [result, count, total]);

  const place = where.point ? 'cerca de ti' : `en ${MUNICIPALITIES[where.municipality]}`;
  const left = total === undefined ? 0 : total - count;
  return (
    <section className="today-basket" aria-label="Canasta básica de hoy">
      <div className="today-head">
        <p className="muted">{current ? area(current.head) : ' '}</p>
        <WherePicker where={where} />
      </div>
      {categories.length > 0 && (
        <ChipRow legend="Categoría">
          {[{ code: '', name: 'Todo' }, ...categories].map((option) => {
            const known = totals[`${where.key}|${option.code}`];
            return (
              <label key={option.code} className="category-chip">
                <input
                  type="radio"
                  name="category"
                  value={option.code}
                  checked={category === option.code}
                  onChange={() => {
                    setCategory(option.code);
                  }}
                />
                {option.name}
                {known !== undefined && (
                  <>
                    {' '}
                    <span className="category-count">{COUNT.format(known)}</span>
                  </>
                )}
              </label>
            );
          })}
        </ChipRow>
      )}
      <p className="muted small">Primero los productos con precio en más tiendas.</p>
      {!result && !items && <SkeletonList kind="card" count={4} />}
      {result && failed && offset === 0 && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {items?.length === 0 && (
        <p className="muted">{`Todavía no hay precios ${place}. Registra el primero.`}</p>
      )}
      {items && items.length > 0 && (
        <>
          <ul className="product-cards" ref={list}>
            {items.map((item) => (
              <ProductCard key={item.productId} item={item} />
            ))}
          </ul>
          {loadingMore && (
            <ul className="product-cards" aria-hidden="true">
              {Array.from({ length: FEW }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </ul>
          )}
          {total !== undefined && current.hasMore && (
            <p className="muted small more-progress">{`Mostrando ${String(count)} de ${String(total)}`}</p>
          )}
          {current.hasMore && !moreFailed && (
            <button
              type="button"
              className="btn ghost"
              disabled={loadingMore}
              aria-busy={loadingMore}
              onClick={() => {
                focusFrom.current = count;
                setFrom({ filter, offset: current.next });
              }}
            >
              {loadingMore
                ? 'Cargando…'
                : left > 0
                  ? `Ver más · quedan ${COUNT.format(left)}`
                  : 'Ver más'}
            </button>
          )}
          {result && moreFailed && (
            <ErrorState
              error={result.error}
              onRetry={() => {
                setAttempt((n) => n + 1);
              }}
            />
          )}
          {!current.hasMore && (
            <p className="muted small more-end">Estos son todos los productos con precio</p>
          )}
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

// Una tarjeta del prototipo: foto, ahorro, nombre, presentación, «Desde», la tienda y la canasta.
const ProductCard = memo(function ProductCard({ item }: { item: Item }) {
  const { items, add, setQuantity } = useBasket();
  const { cheapest } = item;
  const presentation = presentationOf(cheapest);
  const saved = items.find(({ presentationId }) => presentationId === cheapest.presentationId);
  return (
    <li className="product-card">
      <Link to={`/productos/${item.productId}`} className="product-card-link">
        <div className="product-card-top">
          <ProductThumb image={item.image} size="card" category={item.category.code} />
          {item.savingsPercent !== undefined && (
            <span
              className="pill ok savings"
              title={`Ahorra hasta ${String(item.savingsPercent)} % frente a la tienda más cara`}
            >
              <span>{`Ahorra hasta ${String(item.savingsPercent)} %`}</span>
              <span className="sr-only">frente a la tienda más cara</span>
            </span>
          )}
        </div>
        <h2>{item.name}</h2>
        <span className="muted">{presentation}</span>
        <span className="product-card-price">
          <span>
            <span className="muted small">Desde</span>
            <strong>{formatCop(cheapest.priceCop)}</strong>
          </span>
          <span className="product-card-store">
            <span>{`En ${cheapest.establishment.name}`}</span>
            {cheapest.establishment.distanceM !== undefined && (
              <span>{formatDistance(cheapest.establishment.distanceM)}</span>
            )}
          </span>
        </span>
      </Link>
      <button
        type="button"
        className={saved ? 'btn ghost in-basket' : 'btn ghost'}
        aria-pressed={Boolean(saved)}
        onClick={() => {
          if (saved) {
            setQuantity(saved.presentationId, 0);
            return;
          }
          add(
            {
              productId: item.productId,
              productName: item.name,
              categoryCode: item.category.code,
              image: item.image,
              presentationId: cheapest.presentationId,
              presentationLabel: presentation,
            },
            // #76: el aviso dice dónde sale más barato, con el ahorro que calculó el backend.
            item.savingsPercent === undefined
              ? `Desde ${formatCop(cheapest.priceCop)} en ${cheapest.establishment.name}`
              : `Hasta ${String(item.savingsPercent)} % menos comprándolo en ${cheapest.establishment.name}`,
          );
        }}
      >
        {saved ? 'En tu canasta' : 'Agregar a la canasta'}
      </button>
    </li>
  );
});
