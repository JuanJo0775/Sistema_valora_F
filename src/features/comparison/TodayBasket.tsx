import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components, operations } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SkeletonCard, SkeletonList } from '../../shared/ui/Skeleton';
import { useBasket } from '../basket/basketContext';
import { ProductThumb } from '../catalog/ProductThumb';
import '../catalog/catalog.css';
import { MUNICIPALITIES } from './criteria';
import { useWhere } from './WhereChooser';
import { WhereChip } from './WhereChip';
import './comparison.css';

type Featured = operations['listFeaturedProducts']['responses'][200]['content']['application/json'];
type Item = Featured['items'][number];
type Category = components['schemas']['Category'];

const FEW = 6;
const MORE = 20;
const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

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

// #66 (prototipo, RF-008 y RF-009): la canasta básica del Inicio. Los productos con precio en más
// tiendas del municipio o de 1,5 km a la redonda, y el más bajo de cada uno. El orden, el precio
// y el ahorro los decide el backend (B#120, B#128); el criterio se dice en pantalla (EC-06).
export function TodayBasket() {
  const where = useWhere();
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [limit, setLimit] = useState(FEW);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<
    { key: string; featured: Featured } | { key: string; error: unknown } | null
  >(null);
  // Lo ya cargado del MISMO filtro (lugar y categoría) se queda en pantalla mientras llegan más
  // productos: pedir más no vacía la lista ni mueve el scroll.
  const [kept, setKept] = useState<{ filter: string; featured: Featured } | null>(null);
  const [announce, setAnnounce] = useState('');
  const list = useRef<HTMLUListElement>(null);
  const focusNew = useRef(false);
  const filter = `${where.key}|${category}`;
  const key = `${filter}|${String(limit)}|${String(attempt)}`;

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
    const query = { ...where.query, limit, ...(category ? { category } : {}) };
    call(api.GET('/featured-products', { params: { query } }))
      .then((featured) => {
        if (!current) return;
        setOutcome({ key, featured });
        setKept({ filter, featured });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [where.ready, where.query, category, limit, key, filter]);

  const result = outcome?.key === key ? outcome : null;
  const previous = kept?.filter === filter ? kept.featured : null;
  const featured = result && 'featured' in result ? result.featured : previous;
  const more = limit > FEW && previous !== null;
  const loadingMore = more && !result;
  const moreFailed = more && result !== null && 'error' in result;
  const total = featured?.items.length ?? 0;
  const added = more && result && 'featured' in result ? total - FEW : 0;

  useEffect(() => {
    if (added <= 0 || !focusNew.current) return;
    focusNew.current = false;
    setAnnounce(`Se cargaron ${String(added)} ${added === 1 ? 'producto más' : 'productos más'}`);
    // Sin scroll: la lista crece hacia abajo y lo que ya se veía no se mueve.
    const target = list.current?.querySelectorAll('a')[FEW] as HTMLElement | undefined;
    target?.focus({ preventScroll: true });
  }, [added]);
  const place = where.point ? 'cerca de ti' : `en ${MUNICIPALITIES[where.municipality]}`;
  return (
    <section className="today-basket" aria-label="Canasta básica de hoy">
      <div className="today-head">
        <p className="muted">{featured ? area(featured) : ' '}</p>
        <WhereChip
          where={where}
          backLabel="Ver por municipio"
          onLeaveLocation={() => {
            setLimit(FEW);
          }}
        />
      </div>
      {categories.length > 0 && (
        <fieldset role="radiogroup" className="category-chips">
          <legend className="sr-only">Categoría</legend>
          {[{ code: '', name: 'Todo' }, ...categories].map((option) => (
            <label key={option.code} className="category-chip">
              <input
                type="radio"
                name="category"
                value={option.code}
                checked={category === option.code}
                onChange={() => {
                  setLimit(FEW);
                  setCategory(option.code);
                }}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
      )}
      <p className="muted small">Primero los productos con precio en más tiendas.</p>
      {!result && !featured && <SkeletonList kind="card" count={4} />}
      {result && 'error' in result && !moreFailed && (
        <ErrorState
          error={result.error}
          onRetry={() => {
            setAttempt((count) => count + 1);
          }}
        />
      )}
      {featured?.items.length === 0 && (
        <p className="muted">{`Todavía no hay precios ${place}. Registra el primero.`}</p>
      )}
      {featured && featured.items.length > 0 && (
        <>
          <ul className="product-cards" ref={list}>
            {featured.items.map((item) => (
              <ProductCard key={item.productId} item={item} />
            ))}
          </ul>
          {((limit === FEW && featured.items.length === FEW) || loadingMore) && (
            <button
              type="button"
              className="btn ghost"
              disabled={loadingMore}
              aria-busy={loadingMore}
              onClick={() => {
                focusNew.current = true;
                setLimit(MORE);
              }}
            >
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </button>
          )}
          {loadingMore && (
            <ul className="product-cards" aria-hidden="true">
              <SkeletonCard />
              <SkeletonCard />
            </ul>
          )}
          {moreFailed && 'error' in result && (
            <ErrorState
              error={result.error}
              onRetry={() => {
                setAttempt((count) => count + 1);
              }}
            />
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
function ProductCard({ item }: { item: Item }) {
  const { items, add, setQuantity } = useBasket();
  const { cheapest } = item;
  const presentation = presentationOf(cheapest);
  const saved = items.find(({ presentationId }) => presentationId === cheapest.presentationId);
  return (
    <li className="product-card">
      <Link to={`/productos/${item.productId}`} className="product-card-link">
        <div className="product-card-top">
          <ProductThumb image={item.image} size="card" />
          {item.savingsPercent !== undefined && (
            <span className="pill ok">{`Hasta −${String(item.savingsPercent)} %`}</span>
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
            <span>{cheapest.establishment.name}</span>
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
}
