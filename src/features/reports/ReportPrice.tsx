import { type SyntheticEvent, useEffect, useState } from 'react';
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
import { ReportProblem } from './ReportProblem';
import { type Store, StorePicker } from './StorePicker';
import './reports.css';

type Product = components['schemas']['Product'];

// En Colombia los miles se separan con punto: «2.500» son 2500 pesos (sin centavos).
const toPesos = (text: string) => Number(text.replace(/[.\s$]/g, ''));

// El campo datetime-local escribe la hora del teléfono sin zona: «2026-11-16T09:30».
const toLocalInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// Lo que exige el contrato (ReportCreate), dicho antes de enviar: el servidor vuelve a validarlo.
function problemOf(report: {
  presentationId: string;
  store: Store | null;
  priceCop: number;
  observedAt: Date;
}) {
  if (!report.presentationId) return 'Elige la presentación.';
  if (!report.store) return 'Elige la tienda.';
  const { priceCop } = report;
  if (!Number.isInteger(priceCop) || priceCop < 1 || priceCop > 10_000_000) {
    return 'Escribe el precio en pesos.';
  }
  // El servidor acepta hasta 5 minutos en el futuro (relojes desfasados) y 24 horas atrás.
  const age = Date.now() - report.observedAt.getTime();
  if (Number.isNaN(age) || age < -5 * MINUTE || age > 24 * HOUR) {
    return 'La hora debe ser de las últimas 24 horas.';
  }
  return '';
}

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  if (!productId) {
    return (
      <>
        <h1>¿Qué precio viste?</h1>
        <ProductSearch linkTo={(id) => `/registrar?producto=${id}`} />
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
  const [problem, setProblem] = useState('');
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

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const priceCop = toPesos(price);
    const observedAt = seenAt ? new Date(seenAt) : startedAt;
    const found = problemOf({ presentationId, store, priceCop, observedAt });
    setProblem(found);
    if (found || !store) return;
    setError(null);
    const report = {
      presentationId,
      establishmentId: store.id,
      priceCop,
      priceType: onSale ? ('oferta' as const) : ('normal' as const),
      observedAt: observedAt.toISOString(),
    };
    const body = JSON.stringify(report);
    const key = attempt.body === '' || attempt.body === body ? attempt.key : crypto.randomUUID();
    setAttempt({ key, body });
    setSending(true);
    const size = product?.presentations.find(({ id }) => id === presentationId);
    // ADR-010: se guarda en el teléfono antes de enviarlo; si no hay red, la cola lo envía sola.
    void queue
      .submit({
        idempotencyKey: key,
        body: report,
        label: {
          product: [product?.name, size && formatPresentation(size)].filter(Boolean).join(' · '),
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
              ? 'Gracias: tu precio ayuda a otros a comparar.'
              : 'Se enviará solo cuando haya conexión.'
          }
          action={
            <Link to="/registrar" className="btn">
              Registrar otro en esta tienda
            </Link>
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
        onChange={setPresentationId}
      />
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
      {seenAt === null ? (
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setSeenAt(toLocalInput(startedAt));
          }}
        >
          Lo vi antes
        </button>
      ) : (
        <label className="field">
          ¿Cuándo lo viste?
          <input
            type="datetime-local"
            value={seenAt}
            onChange={(event) => {
              setSeenAt(event.target.value);
            }}
          />
        </label>
      )}
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
      {error !== null && <ReportProblem error={error} />}
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}
