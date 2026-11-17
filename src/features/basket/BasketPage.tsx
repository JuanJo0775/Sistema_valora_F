import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { type BasketItem, useBasket } from './basketContext';
import { CheapestStore } from './CheapestStore';
import './basket.css';

// #31: la canasta es una lista de compras. Lo que falta por comprar va primero; lo comprado se
// tacha y baja al final, para ir marcando en la tienda.
export function BasketPage() {
  const { items, setQuantity, toggleBought, removeBought } = useBasket();
  if (items.length === 0) {
    return (
      <EmptyState
        title="Tu canasta está vacía"
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
        <ul className="basket-list">
          {ordered.map((item) => (
            <BasketRow
              key={item.presentationId}
              item={item}
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
      <CheapestStore items={items} />
    </div>
  );
}

function BasketRow({
  item,
  onQuantity,
  onBought,
}: {
  item: BasketItem;
  onQuantity: (quantity: number) => void;
  onBought: () => void;
}) {
  return (
    <li className={item.bought ? 'basket-row bought' : 'basket-row'}>
      <label className="check">
        <input type="checkbox" checked={item.bought} onChange={onBought} />
        <span className="sr-only">Comprado</span>
      </label>
      <span className="basket-name">
        <strong>{item.productName}</strong>
        <span className="muted">{item.presentationLabel}</span>
      </span>
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
