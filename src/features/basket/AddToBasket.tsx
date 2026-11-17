import { useState } from 'react';
import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { PresentationChoices } from '../catalog/PresentationChoices';
import { useBasket } from './basketContext';

type Product = components['schemas']['Product'];

// #31: agregar a la lista de compras la presentación que se va a comprar (500 g no es 1 kg).
// #65 (prototipo): si el producto ya está en la canasta, se puede quitar desde aquí.
export function AddToBasket({ product }: { product: Product }) {
  const { items, add, setQuantity } = useBasket();
  const [only] = product.presentations.length === 1 ? product.presentations : [];
  const [presentationId, setPresentationId] = useState(only?.id ?? '');
  const [added, setAdded] = useState('');
  const [problem, setProblem] = useState('');
  const inBasket = items.filter(({ productId }) => productId === product.id);

  const addChosen = () => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    if (!presentation) {
      setProblem('Elige la presentación.');
      return;
    }
    const presentationLabel = formatPresentation(presentation);
    add({ productId: product.id, productName: product.name, presentationId, presentationLabel });
    setProblem('');
    setAdded(`${product.name} · ${presentationLabel}`);
  };

  const removeAll = () => {
    for (const item of inBasket) setQuantity(item.presentationId, 0);
    setAdded('');
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
              onChange={setPresentationId}
            />
          )}
          {problem && (
            <p role="alert" className="banner warn">
              {problem}
            </p>
          )}
          <button type="button" className="btn ghost" onClick={addChosen}>
            Agregar a la canasta
          </button>
        </>
      )}
      {added && (
        <p role="status" className="muted">
          {`${added} agregado a tu canasta. `}
          <Link to="/canasta">Ver canasta</Link>
        </p>
      )}
    </div>
  );
}
