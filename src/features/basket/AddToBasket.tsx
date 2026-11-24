import { type ReactNode, useId, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { useMediaQuery } from '../../shared/useMediaQuery';
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
  // En celular y tableta (hasta 959 px) la acción es la barra fija de abajo; en computador, el panel.
  const narrow = useMediaQuery('(width < 960px)');

  const addChosen = () => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    if (!presentation) {
      setProblem('Elige la presentación.');
      return;
    }
    const presentationLabel = formatPresentation(presentation);
    // El aviso de abajo dice qué se agregó (#76).
    add({
      productId: product.id,
      productName: product.name,
      categoryCode: product.category.code,
      image: product.image,
      presentationId,
      presentationLabel,
    });
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
          {/* Solo hay un botón de agregar a la vez: en celular existe el de la barra y el del panel no
              se dibuja (así no recibe foco ni lo lee dos veces el lector de pantalla). */}
          {narrow ? (
            selected && (
              <ActionBar>
                <p id={hint} className="action-bar-info">
                  <strong>{formatPresentation(selected)}</strong>
                  {lowestPrice && <span className="muted">{`Más barato ${lowestPrice}`}</span>}
                </p>
                <button type="button" className="btn" onClick={addChosen} aria-describedby={hint}>
                  Agregar a la canasta
                </button>
              </ActionBar>
            )
          ) : (
            <>
              <button
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
            </>
          )}
        </>
      )}
    </div>
  );
}

// La barra fija va en el hueco que deja el Layout después del contenido principal: está abajo en la
// pantalla, así que el foco llega a ella después de todo lo demás y no antes (orden de foco = orden
// visual). Sin ese hueco (pruebas de la pieza sola) queda donde se dibuja.
function ActionBar({ children }: { children: ReactNode }) {
  const bar = (
    <section className="action-bar" aria-label="Compra rápida">
      {children}
    </section>
  );
  // El hueco existe cuando esta pieza ya se dibujó: se vuelve a leer tras montar.
  const target = useSyncExternalStore(noSubscription, slot, () => null);
  return target ? createPortal(bar, target) : bar;
}

const noSubscription = () => () => undefined;
const slot = () => document.getElementById('acciones-fijas');
