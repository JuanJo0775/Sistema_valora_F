import { useState } from 'react';
import { Link } from 'react-router';
import type { components } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { PresentationChoices } from '../catalog/PresentationChoices';
import { useBasket } from './basketContext';

type Product = components['schemas']['Product'];

// #31: agregar a la lista de compras la presentación que se va a comprar (500 g no es 1 kg).
export function AddToBasket({ product }: { product: Product }) {
  const { add } = useBasket();
  const [only] = product.presentations.length === 1 ? product.presentations : [];
  const [presentationId, setPresentationId] = useState(only?.id ?? '');
  const [added, setAdded] = useState('');
  const [problem, setProblem] = useState('');

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

  return (
    <div className="add-to-basket">
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
      {added && (
        <p role="status" className="muted">
          {`${added} agregado a tu canasta. `}
          <Link to="/canasta">Ver canasta</Link>
        </p>
      )}
    </div>
  );
}
