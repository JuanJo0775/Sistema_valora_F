import { type SyntheticEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { formatPresentation } from '../catalog/presentation';
import { type Store, StorePicker } from './StorePicker';
import './reports.css';

type Product = components['schemas']['Product'];

// En Colombia los miles se separan con punto: «2.500» son 2500 pesos (sin centavos).
const toPesos = (text: string) => Number(text.replace(/[.\s$]/g, ''));

// Lo que exige el contrato (ReportCreate), dicho antes de enviar: el servidor vuelve a validarlo.
function problemOf(report: { presentationId: string; store: Store | null; priceCop: number }) {
  if (!report.presentationId) return 'Elige la presentación.';
  if (!report.store) return 'Elige la tienda.';
  const { priceCop } = report;
  if (!Number.isInteger(priceCop) || priceCop < 1 || priceCop > 10_000_000) {
    return 'Escribe el precio en pesos.';
  }
  return '';
}

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  const [product, setProduct] = useState<Product | null>(null);
  const [presentationId, setPresentationId] = useState('');
  const [store, setStore] = useState<Store | null>(null);
  const [price, setPrice] = useState('');
  const [onSale, setOnSale] = useState(false);
  // EC-07: la clave nace con el reporte; un reintento del mismo reporte usa la misma.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [received, setReceived] = useState(false);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    void call(api.GET('/products/{productId}', { params: { path: { productId } } })).then(
      setProduct,
    );
  }, [productId]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const priceCop = toPesos(price);
    const found = problemOf({ presentationId, store, priceCop });
    setProblem(found);
    if (found || !store) return;
    setError(null);
    call(
      api.POST('/reports', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: {
          presentationId,
          establishmentId: store.id,
          priceCop,
          priceType: onSale ? 'oferta' : 'normal',
          observedAt: new Date().toISOString(),
        },
      }),
    )
      .then(() => {
        setReceived(true);
      })
      // Los mensajes propios de cada respuesta (duplicado, ráfaga, fecha) llegan con la #11.
      .catch((failure: unknown) => {
        setError(failure);
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
      <label className="check">
        <input
          type="checkbox"
          checked={onSale}
          onChange={(event) => {
            setOnSale(event.target.checked);
          }}
        />
        Es oferta
      </label>
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      <button type="submit" className="btn">
        Enviar
      </button>
    </form>
  );
}
