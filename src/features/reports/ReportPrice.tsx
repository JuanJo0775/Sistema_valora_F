import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { formatCop } from '../../shared/money';
import { readMunicipality } from '../comparison/lastMunicipality';
import { formatPresentation } from '../catalog/presentation';
import { PresentationChoices } from '../catalog/PresentationChoices';
import { ProductSearch } from '../catalog/ProductSearch';
import { isUsabilityMode } from '../../shared/usabilityMode';
import { secondsSince, Stopwatch } from './Stopwatch';
import { useReportQueue } from '../../pwa/queueContext';
import { readLastStore, saveLastStore } from './lastStore';
import { readRecentProducts, saveRecentProduct } from './lastProducts';
import { judgePrice, referenceFrom, suggestPrice } from './plausibility';
import { parsePrice } from './price';
import { ReportProblem } from './ReportProblem';
import { type Store, StorePicker } from './StorePicker';
import '../auth/field.css';
import './reports.css';

type Product = components['schemas']['Product'];
type Offer = components['schemas']['ComparisonItem'];

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// EC-01: una sola pantalla con lo que ya se sabe lleno, para reportar en 15 segundos o menos.
export function ReportPrice() {
  const [params] = useSearchParams();
  const productId = params.get('producto') ?? '';
  // `?tienda=<id>` deja la tienda elegida de antemano (por ejemplo desde la página de una tienda).
  // Si no es un UUID se ignora; si la tienda no existe, ReportForm también la ignora.
  const wantedStore = params.get('tienda') ?? '';
  const storeId = UUID.test(wantedStore) ? wantedStore : '';
  if (!productId) {
    return (
      <>
        <h1>¿Qué precio viste?</h1>
        <p className="muted">Busca el producto por su nombre o su código de barras.</p>
        <ProductSearch
          linkTo={(id) => `/registrar?producto=${id}${storeId ? `&tienda=${storeId}` : ''}`}
        />
        <RecentProducts storeId={storeId} />
      </>
    );
  }
  // Cada producto empieza un reporte nuevo: su propia clave, su hora y nada del anterior.
  return <ReportForm key={productId} productId={productId} storeId={storeId} />;
}

function ReportForm({ productId, storeId }: { productId: string; storeId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [presentationId, setPresentationId] = useState('');
  const [store, setStore] = useState<Store | null>(readLastStore);
  // Si la persona ya eligió una tienda, la de la dirección llega tarde y no la pisa.
  const pickedStore = useRef(false);
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
  // Verdadero si la persona confirmó un precio atípico: queda en revisión antes de mostrarse.
  const [inReview, setInReview] = useState(false);
  // #79 y #28: solo en el modo prueba de usabilidad, cuánto tardó el registro (EC-01).
  const [testing] = useState(isUsabilityMode);
  const [tookSeconds, setTookSeconds] = useState<number | null>(null);
  const queue = useReportQueue();
  const [problem, setProblem] = useState<Problem | null>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  // EC-03: lo que ya se ve para la presentación elegida. Si la consulta falla o tarda, sigue sin referencia.
  const [offers, setOffers] = useState<Offer[]>([]);
  // El precio atípico espera la confirmación de la persona antes de enviarse.
  const [doubt, setDoubt] = useState<number | null>(null);
  const doubtRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!storeId) return;
    let current = true;
    call(
      api.GET('/establishments/{establishmentId}/prices', {
        params: { path: { establishmentId: storeId } },
      }),
    )
      .then(({ establishment }) => {
        if (current && !pickedStore.current) setStore(establishment);
      })
      // Una tienda que no existe (o que no carga) se ignora: queda la última elegida.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [storeId]);

  useEffect(() => {
    let current = true;
    // Solo el municipio recordado: la ubicación de la persona no se manda.
    call(
      api.GET('/products/{productId}/comparison', {
        params: {
          path: { productId },
          query: { municipality: readMunicipality(), sort: 'unit_price', onlyCurrent: true },
        },
      }),
    )
      .then(({ results }) => {
        if (current) setOffers(results);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [productId]);

  useEffect(() => {
    if (doubt !== null) doubtRef.current?.focus();
  }, [doubt]);

  const reference = presentationId ? referenceFrom(offers, presentationId) : null;
  const suggestion = doubt !== null && reference ? suggestPrice(doubt, reference) : null;
  // Cierra la duda y devuelve a la persona al campo, con el valor escrito.
  const fixPrice = () => {
    setDoubt(null);
    priceRef.current?.focus();
  };
  const chosenSize = product?.presentations.find(({ id }) => id === presentationId);
  // Al corregir el campo que falló, su aviso se quita.
  const clear = (field: Field) => {
    setProblem((now) => (now?.field === field ? null : now));
  };

  // «confirmed»: la persona ya dijo «Sí, ese es el precio» a un precio atípico.
  const run = (confirmed: boolean) => {
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
    const plausibility = judgePrice(found.priceCop, reference);
    if (plausibility === 'imposible') {
      setDoubt(null);
      setProblem({
        field: 'price',
        text: 'Revisa el precio: ¿le faltan ceros? Ningún producto cuesta menos de $100.',
      });
      priceRef.current?.focus();
      return;
    }
    if (plausibility === 'atipico' && !confirmed) {
      setDoubt(found.priceCop);
      // Si el bloque ya estaba abierto, el efecto no cambia: el foco vuelve a él.
      doubtRef.current?.focus();
      return;
    }
    send(found.priceCop, observedAt, store, plausibility === 'atipico');
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    run(false);
  };

  const send = (priceCop: number, observedAt: Date, chosenStore: Store, reviewed: boolean) => {
    setDoubt(null);
    setError(null);
    const report = {
      presentationId,
      establishmentId: chosenStore.id,
      priceCop,
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
          store: chosenStore.name,
        },
      })
      .then((result) => {
        if (result.kind === 'rechazado') {
          setError(result.problem);
          setSending(false);
          return;
        }
        saveLastStore(chosenStore);
        if (product) saveRecentProduct({ id: productId, name: product.name });
        setTookSeconds(secondsSince(startedAt));
        setInReview(reviewed);
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
          focus
          text={
            done === 'recibido'
              ? inReview
                ? 'Gracias: un moderador lo revisará antes de mostrarlo. El estado de tu aporte lo ves en «Mis aportes».'
                : 'Gracias: tu precio ayuda a otros a comparar. Ya cuenta en la comparación; el estado de tu aporte lo ves en «Mis aportes».'
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
          setDoubt(null);
          clear('presentation');
        }}
      />
      <FieldProblem problem={problem} field="presentation" id="error-presentacion" />
      <StorePicker
        value={store}
        onChange={(chosen) => {
          pickedStore.current = true;
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
              setDoubt(null);
              clear('price');
            }}
          />
        </label>
        <p id="ayuda-precio" className="muted price-note">
          {chosenSize
            ? `Es el precio de ${formatPresentation(chosenSize)}.`
            : 'Es el precio de la presentación que elijas.'}
        </p>
        <details className="price-help">
          <summary>¿Cómo escribirlo?</summary>
          <p className="muted">Puedes escribirlo como 4600, 4.600 o $4.600.</p>
        </details>
        <FieldProblem problem={problem} field="price" id="error-precio" />
      </div>
      <div className="report-extras">
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
      </div>
      <FieldProblem problem={problem} field="time" id="error-hora" />
      {doubt !== null && reference && (
        <div
          ref={doubtRef}
          role="alertdialog"
          aria-live="assertive"
          aria-labelledby="duda-titulo"
          aria-describedby="duda-texto"
          tabIndex={-1}
          className="price-doubt"
          onKeyDown={(event) => {
            if (event.key === 'Escape') fixPrice();
          }}
        >
          <h2 id="duda-titulo">Revisa el precio</h2>
          <p id="duda-texto">
            {`Lo más barato que vemos para esta presentación es ${formatCop(reference.min)} y lo más caro ${formatCop(reference.max)}. Tu precio es ${formatCop(doubt)}. ¿Está bien?`}
          </p>
          {suggestion !== null && <p>{`¿Querías escribir ${formatCop(suggestion)}?`}</p>}
          <p className="muted">Un moderador puede revisarlo antes de mostrarlo.</p>
          <div className="actions">
            {suggestion !== null && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPrice(String(suggestion));
                  fixPrice();
                }}
              >
                {`Sí, escribir ${formatCop(suggestion)}`}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={fixPrice}>
              Corregir el precio
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                run(true);
              }}
            >
              Sí, ese es el precio
            </button>
          </div>
        </div>
      )}
      {error !== null && <ReportProblem error={error} />}
      {/* En el celular «Enviar» es una barra fija abajo, sobre la barra de navegación. */}
      <div className="report-bar">
        <button type="submit" className="btn" disabled={sending}>
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
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
function RecentProducts({ storeId }: { storeId: string }) {
  const [recent] = useState(readRecentProducts);
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recientes">
      <h2 id="recientes">Los últimos que registraste</h2>
      <ul className="actions">
        {recent.map(({ id, name }) => (
          <li key={id}>
            <Link
              to={`/registrar?producto=${id}${storeId ? `&tienda=${storeId}` : ''}`}
              className="btn ghost"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
