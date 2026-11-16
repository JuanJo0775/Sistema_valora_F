import { type SyntheticEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { formatPresentation } from '../catalog/presentation';
import { type Store, StorePicker } from './StorePicker';
import './reports.css';

type Product = components['schemas']['Product'];

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [presentationId, setPresentationId] = useState('');
  const [store, setStore] = useState<Store | null>(null);
  const [price, setPrice] = useState('');
  // EC-07: la clave nace con el reporte; un reintento del mismo reporte usa la misma.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [received, setReceived] = useState(false);

  useEffect(() => {
    void call(api.GET('/products/{productId}', { params: { path: { productId } } })).then(
      setProduct,
    );
  }, [productId]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!store) return;
    void call(
      api.POST('/reports', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: {
          presentationId,
          establishmentId: store.id,
          priceCop: Number(price),
          priceType: 'normal',
          observedAt: new Date().toISOString(),
        },
      }),
    ).then(() => {
      setReceived(true);
    });
  };

  if (received) {
    return <EmptyState title="Recibido" text="Gracias: tu precio ayuda a otros a comparar." />;
  }
  if (!product) return null;
  return (
    <form className="report" onSubmit={submit}>
      <h1>{product.name}</h1>
      <fieldset role="radiogroup" className="choices">
        <legend>Presentación</legend>
        {product.presentations.map((presentation) => (
          <label key={presentation.id} className="choice">
            <input
              type="radio"
              name="presentation"
              value={presentation.id}
              checked={presentationId === presentation.id}
              onChange={() => {
                setPresentationId(presentation.id);
              }}
            />
            {formatPresentation(presentation)}
          </label>
        ))}
      </fieldset>
      <StorePicker value={store} onChange={setStore} />
      <label className="field">
        Precio en pesos
        <input
          inputMode="numeric"
          autoComplete="off"
          value={price}
          onChange={(event) => {
            setPrice(event.target.value);
          }}
        />
      </label>
      <button type="submit" className="btn">
        Enviar
      </button>
    </form>
  );
}
