import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import type { components, operations } from '../../shared/api/schema';
import { formatDistance } from '../../shared/location';
import { formatCop } from '../../shared/money';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
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
  const key = `${where.key}|${category}|${String(limit)}|${String(attempt)}`;

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
        if (current) setOutcome({ key, featured });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [where.ready, where.query, category, limit, key]);

  const result = outcome?.key === key ? outcome : null;
  const featured = result && 'featured' in result ? result.featured : null;
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
      {!result && <Loading />}
      {result && 'error' in result && (
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
          <ul className="product-cards">
            {featured.items.map((item) => (
              <ProductCard key={item.productId} item={item} />
            ))}
          </ul>
          {limit === FEW && featured.items.length === FEW && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setLimit(MORE);
              }}
            >
              Ver más
            </button>
          )}
        </>
      )}
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
