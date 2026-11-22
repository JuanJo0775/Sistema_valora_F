import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { type BasketItem, useBasket } from './basketContext';
import { ProductThumb } from '../catalog/ProductThumb';
import { useWhere } from '../comparison/useWhere';
import { WhereToBuy } from './WhereToBuy';
import { useStoreTotals } from './useStoreTotals';
import './basket.css';

// #31: la canasta es una lista de compras. Lo que falta por comprar va primero; lo comprado se
// tacha y baja al final, para ir marcando en la tienda.
export function BasketPage() {
  const { items, setQuantity, toggleBought, removeBought } = useBasket();
  // Dónde buscar (municipio guardado, o la ubicación del momento con su radio) manda en las fichas de
  // «Dónde comprar» y en el «dónde sale más barato» de cada producto: las mismas cuentas para todo.
  const where = useWhere();
  const { municipality, totals } = useStoreTotals(where.ready ? items : [], where.query);
  const bestStore = totals.status === 'ready' ? totals.best?.store.name : undefined;
  if (items.length === 0) {
    return (
      <EmptyState
        title="Tu canasta está vacía"
        level={1}
        text="Agrega productos desde su página para armar tu lista de compras."
        action={
          <Link to="/" className="btn">
            Buscar productos
          </Link>
        }
      />
    );
  }
  const ordered = [...items].sort((a, b) => Number(a.bought) - Number(b.bought));
  return (
    <div className="with-side">
      <section className="basket">
        <h1>Mi canasta</h1>
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
      </section>
      <WhereToBuy
        where={where}
        municipality={municipality}
        totals={totals}
        items={items.filter(({ bought }) => !bought)}
      />
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
