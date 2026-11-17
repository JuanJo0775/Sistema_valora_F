import { useEffect } from 'react';
import { Link } from 'react-router';
import { useBasket } from './basketContext';
import './basket.css';

const SHOWN_MS = 5000;

// #76 (prototipo): el aviso de abajo cada vez que se agrega un producto a la canasta. Lo anuncian
// los lectores de pantalla (role="status") y se va solo a los pocos segundos.
export function BasketToast() {
  const { items, notice, dismiss } = useBasket();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismiss, SHOWN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, dismiss]);

  if (!notice) return null;
  const toBuy = items.filter(({ bought }) => !bought).length;
  return (
    <div role="status" className="basket-toast">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="basket-toast-icon">
        <path d="M5 9h14l-1.5 10h-11zM9 9V7a3 3 0 0 1 6 0v2" />
      </svg>
      <div className="basket-toast-text">
        <strong>{`${notice.productName} agregado a tu canasta`}</strong>
        <span>
          {[notice.detail, `Tu canasta: ${String(toBuy)} ${toBuy === 1 ? 'producto' : 'productos'}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <Link to="/canasta" className="basket-toast-link" onClick={dismiss}>
        Ver canasta
      </Link>
      <button
        type="button"
        className="basket-toast-close"
        aria-label="Cerrar aviso"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}
