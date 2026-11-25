import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { restoreFocus } from '../../shared/focus';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { shortDay } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { ErrorState } from '../../shared/ui/ErrorState';
import { ResultNotice } from '../../shared/ui/ResultNotice';

type Promotion = components['schemas']['MerchantPromotion'];
type Draft = components['schemas']['Promotion'];
type Price = components['schemas']['OfficialPriceWithFreshness'];
const TYPES = {
  descuento_porcentual: 'Descuento porcentual',
  precio_especial: 'Precio especial',
  pague_x_lleve_y: 'Lleve Y, pague X',
} satisfies Record<Draft['type'], string>;
const PAYMENT = {
  cualquiera: 'Cualquier medio',
  efectivo: 'Solo efectivo',
  tarjeta: 'Solo tarjeta',
} satisfies Record<Draft['conditions']['paymentMethod'], string>;
const STATUS = {
  activa: { label: 'Activa', tone: 'ok' },
  pausada: { label: 'Pausada', tone: 'warn' },
  vencida: { label: 'Vencida', tone: 'mute' },
  programada: { label: 'Programada', tone: 'mute' },
} satisfies Record<Promotion['status'], { label: string; tone: string }>;

const dateSpan = (from: string, until: string) =>
  (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;

function offerLabel(promotion: Promotion) {
  if (promotion.type === 'pague_x_lleve_y') {
    return `Lleve ${String(promotion.takeY)}, pague ${String(promotion.payX)}`;
  }
  if (promotion.type === 'descuento_porcentual')
    return `${String(promotion.percent)} % de descuento`;
  return TYPES.precio_especial;
}

export function MerchantPromotions({
  items,
  prices,
  label,
  onChanged,
  onPrices,
}: {
  items?: Promotion[];
  prices: Price[] | undefined;
  label: (id: string) => string;
  onChanged: () => void;
  onPrices: () => void;
}) {
  const [type, setType] = useState<Draft['type']>('descuento_porcentual');
  const [presentation, setPresentation] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  // Qué acción dio el último resultado, para mostrarlo junto a ella.
  const [where, setWhere] = useState<'publish' | 'retire'>('publish');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const retireButtons = useRef(new Map<string, HTMLButtonElement>());
  const cancelled = useRef<string | null>(null);

  // El resultado de la acción recibe el foco: el botón que la pidió ya no existe o cambió.
  useEffect(() => {
    if (notice) restoreFocus(statusRef.current);
  }, [notice]);
  // Al cancelar el retiro, el foco vuelve al botón «Retirar promoción» de esa promoción.
  useEffect(() => {
    if (confirm !== null || cancelled.current === null) return;
    retireButtons.current.get(cancelled.current)?.focus();
    cancelled.current = null;
  }, [confirm]);
  const eligible = prices?.filter(({ freshness }) => freshness === 'vigente') ?? [];
  const selected = eligible.find(({ presentationId }) => presentationId === presentation);

  async function mutate(
    at: 'publish' | 'retire',
    action: () => Promise<unknown>,
    success: string,
    finish: () => void,
  ) {
    if (lock.current) return;
    lock.current = true;
    setWhere(at);
    setBusy(true);
    setNotice('');
    setError(null);
    setProblem('');
    try {
      await action();
      finish();
      setNotice(success);
      onChanged();
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selected) return;
    const data = new FormData(form);
    const value = (key: string) => {
      const field = data.get(key);
      return typeof field === 'string' ? field : '';
    };
    const validFrom = value('validFrom');
    const validUntil = value('validUntil');
    const span = dateSpan(validFrom, validUntil);
    const payX = Number(value('payX'));
    const takeY = Number(value('takeY'));
    if (!Number.isFinite(span) || span < 1 || span > 30) {
      setNotice('');
      setError(null);
      setProblem('Elige un período de 1 a 30 días, con ambas fechas incluidas.');
      return;
    }
    if (type === 'pague_x_lleve_y' && takeY <= payX) {
      setNotice('');
      setError(null);
      setProblem('Las unidades que lleva el cliente deben ser más que las que paga.');
      return;
    }
    const limit = value('maxPerCustomer');
    const payment = value('paymentMethod');
    const paymentMethod = payment === 'efectivo' || payment === 'tarjeta' ? payment : 'cualquiera';
    const offer =
      type === 'descuento_porcentual'
        ? { percent: Number(value('percent')) }
        : type === 'precio_especial'
          ? { specialPriceCop: Number(value('specialPriceCop')) }
          : { payX, takeY };
    const body: Draft = {
      presentationId: selected.presentationId,
      type,
      ...offer,
      validFrom,
      validUntil,
      conditions: {
        ...(limit ? { maxPerCustomer: Number(limit) } : {}),
        whileStocksLast: data.has('whileStocksLast'),
        paymentMethod,
      },
    };
    void mutate(
      'publish',
      () => call(api.POST('/commerce/promotions', { body })),
      'Promoción publicada.',
      () => {
        form.reset();
        setPresentation('');
        setType('descuento_porcentual');
      },
    );
  }

  const needsPrice = error instanceof ApiError && error.code === 'OFFICIAL_PRICE_REQUIRED';
  // ADR-037: el mensaje del servidor dice el rango; va junto al botón que lo provocó.
  // H20: dos promociones de la misma presentación no pueden solaparse; el mensaje dice las fechas.
  const rejected =
    error instanceof ApiError &&
    (error.code === 'IMPLAUSIBLE_OFFICIAL_PRICE' || error.code === 'PROMOTION_OVERLAP')
      ? error.message
      : '';

  // H21, H27: un único aviso a la vez, junto a la acción que lo dio.
  const result = (at: 'publish' | 'retire') => (
    <ResultNotice ref={where === at ? statusRef : undefined} text={where === at ? notice : ''} />
  );
  const failure = error !== null && !rejected && <ErrorState error={error} />;

  return (
    <>
      {items &&
        (items.length > 0 ? (
          <ul className="merchant-price-list">
            {items.map((promotion) => (
              <li key={promotion.id}>
                <h3>{label(promotion.presentationId)}</h3>
                <p>
                  {offerLabel(promotion)}{' '}
                  <span className={`pill ${STATUS[promotion.status].tone}`}>
                    {STATUS[promotion.status].label}
                  </span>
                </p>
                {promotion.officialPriceCop !== null && promotion.promotedPriceCop !== null && (
                  <p>
                    Antes {formatCop(promotion.officialPriceCop)} · Con promoción{' '}
                    {formatCop(promotion.promotedPriceCop)} por unidad
                  </p>
                )}
                <p className="muted">
                  Del {shortDay(promotion.validFrom)} al {shortDay(promotion.validUntil)} de{' '}
                  {promotion.validUntil.slice(0, 4)}
                </p>
                <p className="muted">
                  {PAYMENT[promotion.conditions.paymentMethod]}
                  {promotion.conditions.maxPerCustomer !== undefined &&
                    ` · Máximo ${String(promotion.conditions.maxPerCustomer)} por cliente`}
                  {promotion.conditions.whileStocksLast && ' · Hasta agotar existencias'}
                </p>
                {promotion.status === 'pausada' && (
                  <p className="muted">Reconfirma el precio oficial para volver a activarla.</p>
                )}
                {where === 'retire' && confirm === promotion.id && failure}
                {confirm === promotion.id ? (
                  <div className="actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      autoFocus
                      onClick={() => {
                        void mutate(
                          'retire',
                          () =>
                            call(
                              api.DELETE('/commerce/promotions/{promotionId}', {
                                params: { path: { promotionId: promotion.id } },
                              }),
                            ),
                          'Promoción retirada.',
                          () => {
                            setConfirm(null);
                          },
                        );
                      }}
                    >
                      Confirmar retiro
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        cancelled.current = promotion.id;
                        setError(null);
                        setConfirm(null);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busy}
                    ref={(node) => {
                      if (node) retireButtons.current.set(promotion.id, node);
                      else retireButtons.current.delete(promotion.id);
                    }}
                    onClick={() => {
                      setError(null);
                      setConfirm(promotion.id);
                    }}
                  >
                    Retirar promoción
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aún no tienes promociones publicadas.</p>
        ))}
      {result('retire')}

      {prices &&
        (eligible.length > 0 ? (
          <form className="merchant-price-form merchant-promotion-form" onSubmit={submit}>
            <h3>Nueva promoción</h3>
            <fieldset className="merchant-promotion-fields" disabled={busy}>
              <label className="field">
                Presentación
                <select
                  value={presentation}
                  onChange={(event) => {
                    setPresentation(event.target.value);
                  }}
                  required
                >
                  <option value="">Elige una presentación</option>
                  {eligible.map((price) => (
                    <option key={price.presentationId} value={price.presentationId}>
                      {label(price.presentationId)} · {formatCop(price.priceCop)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Tipo de promoción
                <select
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as Draft['type']);
                  }}
                >
                  {Object.entries(TYPES).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {type === 'descuento_porcentual' && (
                <label className="field">
                  Descuento (%)
                  <input name="percent" type="number" min="1" max="90" required />
                </label>
              )}
              {type === 'precio_especial' && (
                <label className="field">
                  Precio especial en pesos
                  <input
                    name="specialPriceCop"
                    type="number"
                    min="100"
                    max={selected && selected.priceCop - 1}
                    required
                  />
                </label>
              )}
              {type === 'pague_x_lleve_y' && (
                <>
                  <label className="field">
                    Unidades que lleva
                    <input name="takeY" type="number" min="2" required />
                  </label>
                  <label className="field">
                    Unidades que paga
                    <input name="payX" type="number" min="1" required />
                  </label>
                </>
              )}
              <label className="field">
                Desde
                <input name="validFrom" type="date" required />
              </label>
              <label className="field">
                Hasta
                <input name="validUntil" type="date" required />
              </label>
              <label className="field">
                Máximo por cliente (opcional)
                <input name="maxPerCustomer" type="number" min="1" max="99" />
              </label>
              <label className="field">
                Medio de pago
                <select name="paymentMethod">
                  {Object.entries(PAYMENT).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="merchant-stock">
                <input name="whileStocksLast" type="checkbox" /> Hasta agotar existencias
              </label>
            </fieldset>
            {problem && (
              <p id="promotion-problem" className="banner warn" role="alert">
                {problem}
              </p>
            )}
            {where === 'publish' && failure}
            {where === 'publish' && needsPrice && (
              <button type="button" className="btn ghost" onClick={onPrices}>
                Ir a Precios
              </button>
            )}
            {rejected && (
              <p id="promotion-rejected" role="alert" className="field-error">
                {rejected}
              </p>
            )}
            <button
              className="btn"
              type="submit"
              disabled={busy}
              aria-describedby={
                problem ? 'promotion-problem' : rejected ? 'promotion-rejected' : undefined
              }
            >
              Publicar promoción
            </button>
            {result('publish')}
          </form>
        ) : (
          <>
            <p>Publica o reconfirma un precio oficial para crear una promoción.</p>
            {!needsPrice && (
              <button type="button" className="btn ghost" onClick={onPrices}>
                Ir a Precios
              </button>
            )}
          </>
        ))}
    </>
  );
}
