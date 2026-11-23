import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { type BasketItem, useBasket } from './basketContext';
import { ProductThumb } from '../catalog/ProductThumb';
import { useWhere } from '../comparison/useWhere';
import { WhereToBuy } from './WhereToBuy';
import { nearbyTotals } from '../plan/nearby';
import { useStoreTotals } from './useStoreTotals';
import { BasketTabs, type BasketTab, panelId, tabId } from './BasketTabs';
import { SavedLists, type UseMode } from './SavedLists';
import { planName, type SavedPlan } from '../plan/savedPlan';
import { toBasketItems } from '../plan/savedListView';
import { usePlans } from '../plan/usePlans';
import './basket.css';

// #31: la canasta es una lista de compras. Lo que falta por comprar va primero; lo comprado se
// tacha y baja al final, para ir marcando en la tienda.
export function BasketPage() {
  const { items, setQuantity, toggleBought, removeBought, replaceAll, addMany } = useBasket();
  // «Mi lista» o «Guardadas»: la pestaña vive en la dirección (?tab=guardadas), para poder enlazarla.
  const [params, setParams] = useSearchParams();
  const tab: BasketTab = params.get('tab') === 'guardadas' ? 'guardadas' : 'lista';
  const saved = usePlans().length;
  const [notice, setNotice] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  const choose = (next: BasketTab) => {
    setParams(next === 'lista' ? {} : { tab: next }, { replace: true });
  };
  // Usar una lista guardada: reemplaza o suma a «Mi lista», y se pasa a verla.
  const use = (plan: SavedPlan, mode: UseMode) => {
    if (mode === 'replace') replaceAll(toBasketItems(plan));
    else addMany(toBasketItems(plan));
    setNotice(
      mode === 'replace'
        ? `Listo: cargamos «${planName(plan)}» en tu canasta`
        : `Listo: agregamos «${planName(plan)}» a tu canasta`,
    );
    wantFocus.current = true;
    choose('lista');
  };
  useEffect(() => {
    if (wantFocus.current && tab === 'lista') {
      wantFocus.current = false;
      panel.current?.focus();
    }
  }, [tab]);
  // Dónde buscar (municipio guardado, o la ubicación del momento con su radio) manda en las fichas de
  // «Dónde comprar» y en el «dónde sale más barato» de cada producto: las mismas cuentas para todo.
  const where = useWhere();
  // ADR-031: se consulta siempre por municipio (misma URL para todos, caché compartida); la cercanía
  // se calcula aquí, en el dispositivo, con la ubicación en memoria.
  const { totals: all } = useStoreTotals(items, { municipality: where.municipality });
  const totals = nearbyTotals(all, where.point, where.radiusKm);
  const bestStore = totals.status === 'ready' ? totals.best?.store.name : undefined;
  const ordered = [...items].sort((a, b) => Number(a.bought) - Number(b.bought));
  return (
    <div className={tab === 'guardadas' ? 'with-side saved-view' : 'with-side'}>
      <section className="basket">
        <h1>Mi canasta</h1>
        <BasketTabs value={tab} onChange={choose} saved={saved} />
        <p role="status" className="basket-notice">
          {notice}
        </p>
        <div
          ref={panel}
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={-1}
          className="basket-panel"
        >
          {tab === 'guardadas' ? (
            <SavedLists
              basketCount={items.length}
              onUse={use}
              onGoToList={() => {
                choose('lista');
              }}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="Tu canasta está vacía"
              text="Agrega productos desde su página para armar tu lista de compras."
              action={
                <Link to="/" className="btn">
                  Buscar productos
                </Link>
              }
            />
          ) : (
            <>
              <p className="muted">Te decimos dónde te sale más barata.</p>
              <ul className="basket-list">
                {ordered.map((item) => (
                  <BasketRow
                    key={item.presentationId}
                    item={item}
                    store={bestStore}
                    onQuantity={(quantity) => {
                      setQuantity(item.presentationId, quantity);
                    }}
                    onBought={() => {
                      toggleBought(item.presentationId);
                    }}
                  />
                ))}
              </ul>
              {items.some(({ bought }) => bought) && (
                <button type="button" className="btn ghost" onClick={removeBought}>
                  Quitar lo comprado
                </button>
              )}
            </>
          )}
        </div>
      </section>
      {tab === 'lista' && items.length > 0 && (
        <WhereToBuy
          where={where}
          municipality={where.municipality}
          totals={all}
          items={items.filter(({ bought }) => !bought)}
        />
      )}
    </div>
  );
}

function BasketRow({
  item,
  store,
  onQuantity,
  onBought,
}: {
  item: BasketItem;
  // La tienda donde sale más barata toda la canasta (prototipo: «1 kg · Ahorra Más»).
  store: string | undefined;
  onQuantity: (quantity: number) => void;
  onBought: () => void;
}) {
  return (
    <li className={item.bought ? 'basket-row bought' : 'basket-row'}>
      <label className="check basket-check" title="Marcar como comprado">
        <input type="checkbox" checked={item.bought} onChange={onBought} />
        <span className="basket-check-label">Comprado</span>
      </label>
      {/* La foto y el nombre llevan al producto guardado; la foto es decorativa y no repite el enlace
          para lectores de pantalla ni para el teclado. */}
      <Link
        to={`/productos/${item.productId}`}
        className="basket-thumb"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductThumb image={item.image} size="row" category={item.categoryCode} />
      </Link>
      <Link to={`/productos/${item.productId}`} className="basket-name">
        <strong>{item.productName}</strong>
        <span className="muted">
          {store ? `${item.presentationLabel} · ${store}` : item.presentationLabel}
        </span>
      </Link>
      <span className="stepper">
        <button
          type="button"
          aria-label={`Quitar uno de ${item.productName}`}
          onClick={() => {
            onQuantity(item.quantity - 1);
          }}
        >
          −
        </button>
        <span aria-live="polite">{item.quantity}</span>
        <button
          type="button"
          aria-label={`Agregar uno de ${item.productName}`}
          onClick={() => {
            onQuantity(item.quantity + 1);
          }}
        >
          +
        </button>
      </span>
      {/* Prototipo: la papelera quita el producto de una vez. */}
      <button
        type="button"
        className="trash"
        aria-label={`Quitar ${item.productName} de la canasta`}
        onClick={() => {
          onQuantity(0);
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
        </svg>
      </button>
    </li>
  );
}
