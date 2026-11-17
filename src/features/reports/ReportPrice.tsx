import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatPresentation } from '../catalog/presentation';
import { PresentationChoices } from '../catalog/PresentationChoices';
import { ProductSearch } from '../catalog/ProductSearch';
import { isUsabilityMode } from '../../shared/usabilityMode';
import { secondsSince, Stopwatch } from './Stopwatch';
import { useReportQueue } from '../../pwa/queueContext';
import { readLastStore, saveLastStore } from './lastStore';
import { readRecentProducts, saveRecentProduct } from './lastProducts';
import { parsePrice } from './price';
import { ReportProblem } from './ReportProblem';
import { type Store, StorePicker } from './StorePicker';
import '../auth/field.css';
import './reports.css';

type Product = components['schemas']['Product'];

// El campo datetime-local escribe la hora del teléfono sin zona: «2026-11-16T09:30».
const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Field = 'presentation' | 'store' | 'price' | 'time';
interface Problem {
  field: Field;
  text: string;
}

// Lo que exige el contrato (ReportCreate), dicho antes de enviar: el servidor vuelve a validarlo.
function check(report: {
  presentationId: string;
  store: Store | null;
  price: string;
  observedAt: Date;
}): { problem: Problem } | { priceCop: number } {
  if (!report.presentationId) {
    return { problem: { field: 'presentation', text: 'Elige la presentación.' } };
  }
  if (!report.store) return { problem: { field: 'store', text: 'Elige la tienda.' } };
  const price = parsePrice(report.price);
  if ('problem' in price) return { problem: { field: 'price', text: price.problem } };
  // El servidor acepta hasta 5 minutos en el futuro (relojes desfasados) y 24 horas atrás.
  const age = Date.now() - report.observedAt.getTime();
  if (Number.isNaN(age) || age < -5 * MINUTE || age > 24 * HOUR) {
    return { problem: { field: 'time', text: 'La hora debe ser de las últimas 24 horas.' } };
  }
  return { priceCop: price.pesos };
}

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  if (!productId) {
    return (
      <>
        <h1>¿Qué precio viste?</h1>
        <p className="muted">Busca el producto por su nombre o su código de barras.</p>
        <ProductSearch linkTo={(id) => `/registrar?producto=${id}`} />
        <RecentProducts />
      </>
    );
  }
  // Cada producto empieza un reporte nuevo: su propia clave, su hora y nada del anterior.
  return <ReportForm key={productId} productId={productId} />;
}

function ReportForm({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [presentationId, setPresentationId] = useState('');
  const [store, setStore] = useState<Store | null>(readLastStore);
  const [price, setPrice] = useState('');
  const [onSale, setOnSale] = useState(false);
  // EC-07: la clave nace con el reporte y un reintento del mismo reporte usa la misma. Si el reporte
  // cambia después de enviarlo, es otro: el servidor responde 409 a una clave con otro cuerpo.
  const [attempt, setAttempt] = useState(() => ({ key: crypto.randomUUID(), body: '' }));
  // Por defecto «ahora»: la hora en que se empezó el reporte, fija para que un reintento sea igual.
  const [startedAt] = useState(() => new Date());
  // Si lo vio antes, la hora que escribe en el campo (en la hora del teléfono).
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [done, setDone] = useState<'recibido' | 'guardado' | null>(null);
  // #79 y #28: solo en el modo prueba de usabilidad, cuánto tardó el registro (EC-01).
  const [testing] = useState(isUsabilityMode);
  const [tookSeconds, setTookSeconds] = useState<number | null>(null);
  const queue = useReportQueue();
  const [problem, setProblem] = useState<Problem | null>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    call(api.GET('/products/{productId}', { params: { path: { productId } } }))
      .then((found) => {
        setProduct(found);
        // Un toque menos (EC-01): si solo hay una presentación, es esa.
        const [only, ...others] = found.presentations;
        if (only && others.length === 0) setPresentationId(only.id);
      })
      .catch((failure: unknown) => {
        setLoadError(failure);
      });
  }, [productId, loadAttempt]);

  const chosenSize = product?.presentations.find(({ id }) => id === presentationId);
  // Al corregir el campo que falló, su aviso se quita.
  const clear = (field: Field) => {
    setProblem((now) => (now?.field === field ? null : now));
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const observedAt = seenAt ? new Date(seenAt) : startedAt;
    const found = check({ presentationId, store, price, observedAt });
    if ('problem' in found) {
      setProblem(found.problem);
      // El foco va al campo que falló, para corregirlo sin buscarlo.
      if (found.problem.field === 'price') priceRef.current?.focus();
      if (found.problem.field === 'time') timeRef.current?.focus();
      return;
    }
    setProblem(null);
    if (!store) return;
    setError(null);
    const report = {
      presentationId,
      establishmentId: store.id,
      priceCop: found.priceCop,
      priceType: onSale ? ('oferta' as const) : ('normal' as const),
      observedAt: observedAt.toISOString(),
    };
    const body = JSON.stringify(report);
    const key = attempt.body === '' || attempt.body === body ? attempt.key : crypto.randomUUID();
    setAttempt({ key, body });
    setSending(true);
    // ADR-010: se guarda en el teléfono antes de enviarlo; si no hay red, la cola lo envía sola.
    void queue
      .submit({
        idempotencyKey: key,
        body: report,
        label: {
          product: [product?.name, chosenSize && formatPresentation(chosenSize)]
            .filter(Boolean)
            .join(' · '),
          store: store.name,
        },
      })
      .then((result) => {
        if (result.kind === 'rechazado') {
          setError(result.problem);
          setSending(false);
          return;
        }
        saveLastStore(store);
        if (product) saveRecentProduct({ id: productId, name: product.name });
        setTookSeconds(secondsSince(startedAt));
        setDone(result.kind);
      });
  };

  if (done) {
    return (
      <>
        {testing && tookSeconds !== null && (
          <p className="stopwatch">{`Registrado en ${String(tookSeconds)} s.`}</p>
        )}
        <EmptyState
          title={done === 'recibido' ? 'Recibido' : 'Guardado en tu teléfono'}
          text={
            done === 'recibido'
              ? 'Gracias: tu precio ayuda a otros a comparar. Ya cuenta en la comparación; el estado de tu aporte lo ves en «Mis aportes».'
              : 'Se enviará solo cuando haya conexión; al enviarse cuenta en la comparación.'
          }
          action={
            <div className="actions">
              <Link to={`/productos/${productId}`} className="btn">
                {product ? `Ver la comparación de ${product.name}` : 'Ver la comparación'}
              </Link>
              <Link to="/registrar" className="btn ghost">
                Registrar otro en esta tienda
              </Link>
              <Link to={done === 'recibido' ? '/mis-aportes' : '/pendientes'} className="btn ghost">
                {done === 'recibido' ? 'Ver mis aportes' : 'Ver lo guardado en el teléfono'}
              </Link>
            </div>
          }
        />
      </>
    );
  }
  if (loadError !== null) {
    return (
      <ErrorState
        error={loadError}
        onRetry={() => {
          setLoadError(null);
          setLoadAttempt((current) => current + 1);
        }}
      />
    );
  }
  if (!product) return <Loading />;
  return (
    <form className="report" onSubmit={submit}>
      {testing && <Stopwatch since={startedAt} />}
      <h1>{product.name}</h1>
      <PresentationChoices
        presentations={product.presentations}
        value={presentationId}
        onChange={(id) => {
          setPresentationId(id);
          clear('presentation');
        }}
      />
      <FieldProblem problem={problem} field="presentation" id="error-presentacion" />
      <StorePicker
        value={store}
        onChange={(chosen) => {
          setStore(chosen);
          clear('store');
        }}
      />
      <FieldProblem problem={problem} field="store" id="error-tienda" />
      <div className="field-group">
        <label className="field">
          Precio en pesos
          <input
            ref={priceRef}
            inputMode="numeric"
            autoComplete="off"
            value={price}
            aria-describedby={
              problem?.field === 'price' ? 'ayuda-precio error-precio' : 'ayuda-precio'
            }
            aria-invalid={problem?.field === 'price' ? true : undefined}
            onChange={(event) => {
              setPrice(event.target.value);
              clear('price');
            }}
          />
        </label>
        <p id="ayuda-precio" className="muted">
          {chosenSize
            ? `Es el precio de ${formatPresentation(chosenSize)}.`
            : 'Es el precio de la presentación que elijas.'}{' '}
          Puedes escribirlo como 4600, 4.600 o $4.600.
        </p>
        <FieldProblem problem={problem} field="price" id="error-precio" />
      </div>
      {seenAt === null ? (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setSeenAt(toLocalInput(startedAt));
          }}
        >
          Lo vi otro día
        </button>
      ) : (
        <label className="field">
          ¿Cuándo lo viste?
          <input
            ref={timeRef}
            type="datetime-local"
            value={seenAt}
            aria-invalid={problem?.field === 'time' ? true : undefined}
            aria-describedby={problem?.field === 'time' ? 'error-hora' : undefined}
            onChange={(event) => {
              setSeenAt(event.target.value);
              clear('time');
            }}
          />
        </label>
      )}
      <FieldProblem problem={problem} field="time" id="error-hora" />
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
      {error !== null && <ReportProblem error={error} />}
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}

function FieldProblem({
  problem,
  field,
  id,
}: {
  problem: Problem | null;
  field: Field;
  id: string;
}) {
  if (problem?.field !== field) return null;
  return (
    <p id={id} role="alert" className="field-error">
      {problem.text}
    </p>
  );
}

// Con el campo de búsqueda vacío, un atajo: los últimos productos para los que se registró un precio.
function RecentProducts() {
  const [recent] = useState(readRecentProducts);
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recientes">
      <h2 id="recientes">Los últimos que registraste</h2>
      <ul className="actions">
        {recent.map(({ id, name }) => (
          <li key={id}>
            <Link to={`/registrar?producto=${id}`} className="btn ghost">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
