import { useEffect, useId, useRef, useState } from 'react';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { PresentationChoices } from '../catalog/PresentationChoices';
import { useBasket } from './basketContext';
import './basket.css';

type Product = components['schemas']['Product'];

// #31: agregar a la lista de compras la presentación que se va a comprar (500 g no es 1 kg).
// #65 (prototipo): si el producto ya está en la canasta, se puede quitar desde aquí.
// Siempre hay una presentación marcada: la que la persona eligió; si no, la sugerida (la del
// precio más bajo que marcó el backend); si no, la primera.
export function AddToBasket({
  product,
  suggestedPresentationId,
  lowestPrice,
}: {
  product: Product;
  suggestedPresentationId?: string;
  // El precio más bajo que marcó el backend, ya con formato, para la barra de acción.
  lowestPrice?: string;
}) {
  const { items, add, setQuantity } = useBasket();
  const [only] = product.presentations.length === 1 ? product.presentations : [];
  const [chosen, setChosen] = useState('');
  const hint = useId();
  const known = (id: string | undefined) =>
    product.presentations.some((presentation) => presentation.id === id);
  const presentationId =
    [chosen, suggestedPresentationId, product.presentations[0]?.id].find(known) ?? '';
  const selected = product.presentations.find(({ id }) => id === presentationId);
  const [problem, setProblem] = useState('');
  const inBasket = items.filter(({ productId }) => productId === product.id);
  const primary = useRef<HTMLButtonElement>(null);
  const offscreen = useOffscreen(primary, inBasket.length === 0);

  const addChosen = () => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    if (!presentation) {
      setProblem('Elige la presentación.');
      return;
    }
    const presentationLabel = formatPresentation(presentation);
    // El aviso de abajo dice qué se agregó (#76).
    add({ productId: product.id, productName: product.name, presentationId, presentationLabel });
    setProblem('');
  };

  const removeAll = () => {
    for (const item of inBasket) setQuantity(item.presentationId, 0);
  };

  return (
    <div className="add-to-basket">
      {inBasket.length > 0 ? (
        <button type="button" className="btn ghost" onClick={removeAll}>
          Quitar de mi canasta
        </button>
      ) : (
        <>
          {!only && (
            <PresentationChoices
              presentations={product.presentations}
              value={presentationId}
              onChange={setChosen}
            />
          )}
          {problem && (
            <p role="alert" className="banner warn">
              {problem}
            </p>
          )}
          <button
            ref={primary}
            type="button"
            className="btn"
            onClick={addChosen}
            aria-describedby={selected && !only ? hint : undefined}
          >
            Agregar a la canasta
          </button>
          {selected && !only && (
            <p id={hint} className="muted add-hint">
              {`Se agrega ${formatPresentation(selected)}`}
            </p>
          )}
          {/* En el celular, cuando el botón de arriba sale de la pantalla, la misma acción queda
              fija abajo. Solo existe mientras hace falta: no duplica el botón para lectores. */}
          {offscreen && selected && (
            <section className="action-bar" aria-label="Compra rápida">
              <p className="action-bar-info">
                <strong>{formatPresentation(selected)}</strong>
                {lowestPrice && <span className="muted">{`Más barato ${lowestPrice}`}</span>}
              </p>
              <button type="button" className="btn" onClick={addChosen}>
                Agregar a la canasta
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// true cuando el elemento está fuera de la pantalla. Sin IntersectionObserver (pruebas, navegadores
// viejos) vale false: la barra simplemente no aparece y el botón del panel sigue siendo la acción.
function useOffscreen(target: React.RefObject<HTMLElement | null>, active: boolean): boolean {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!active || !element || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setOffscreen(!entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [target, active]);
  return offscreen;
}
