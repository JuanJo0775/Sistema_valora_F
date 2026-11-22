import { useEffect, useRef, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { dayInColombia } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { RequireRole } from '../auth/RequireRole';
import { MerchantPriceEditor, type PriceSelection } from './MerchantPriceEditor';
import { MerchantPriceUpload } from './MerchantPriceUpload';
import './merchant-prices.css';

type Price = components['schemas']['OfficialPriceWithFreshness'];
type Alert = components['schemas']['MerchantAlert'];
type Outcome<T> = { data: T } | { error: unknown };
const FRESHNESS: Record<Price['freshness'], { label: string; tone: string }> = {
  vigente: { label: 'Vigente', tone: 'ok' },
  por_confirmar: { label: 'Por confirmar', tone: 'warn' },
  desactualizado: { label: 'Desactualizado', tone: 'bad' },
};

export function MerchantPrices() {
  return (
    <RequireRole role="comercio">
      <PricePanel />
    </RequireRole>
  );
}

function PricePanel() {
  const [prices, setPrices] = useState<Outcome<Price[]> | null>(null);
  const [alerts, setAlerts] = useState<Outcome<Alert[]> | null>(null);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<PriceSelection | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const editor = useRef<HTMLHeadingElement>(null);
  const reconfirmButton = useRef<HTMLButtonElement>(null);

  const refresh = () => {
    setRevision((now) => now + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    call(api.GET('/commerce/prices', { signal }))
      .then(({ items }) => {
        if (signal.aborted) return;
        setPrices({ data: items });
        const storeId = items[0]?.establishmentId;
        if (!storeId) return;
        return call(
          api.GET('/establishments/{establishmentId}/prices', {
            params: { path: { establishmentId: storeId } },
            cache: 'no-store',
            signal,
          }),
        )
          .then(({ prices }) => {
            if (signal.aborted) return;
            setLabels(
              new Map(
                prices.map(({ presentationId, productName }) => [presentationId, productName]),
              ),
            );
          })
          .catch(() => {
            // Los precios privados siguen disponibles aunque falle la consulta de nombres.
          });
      })
      .catch((failure: unknown) => {
        if (!signal.aborted) setPrices({ error: failure });
      });
    call(api.GET('/commerce/alerts', { signal }))
      .then(({ items }) => {
        if (!signal.aborted) setAlerts({ data: items });
      })
      .catch((failure: unknown) => {
        if (!signal.aborted) setAlerts({ error: failure });
      });
    return () => {
      controller.abort();
    };
  }, [revision]);

  const listed = prices && 'data' in prices ? prices.data : [];
  const productLabel = (id: string) =>
    labels.get(id) ??
    (alerts && 'data' in alerts
      ? alerts.data.find((alert) => alert.presentationId === id)?.productName
      : undefined) ??
    `Presentación ${id}`;

  const choose = (presentationId: string, label = productLabel(presentationId)) => {
    const price = listed.find((item) => item.presentationId === presentationId);
    setSelection({ presentationId, label, priceCop: price?.priceCop });
    setError(null);
    editor.current?.focus();
  };

  const update = async (action: () => Promise<string>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      setNotice(await action());
      refresh();
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const reconfirm = () =>
    update(async () => {
      const result = await call(api.POST('/commerce/prices/reconfirm'));
      return `Precios reconfirmados: ${String(result.reconfirmed)}.`;
    });

  const save = (presentationId: string, priceCop: number) =>
    update(async () => {
      await call(api.PUT('/commerce/prices', { body: { presentationId, priceCop } }));
      setSelection(null);
      return 'Precio oficial publicado.';
    });

  return (
    <div className="merchant-prices">
      <BackLink fallback="/yo" />
      <h1>Precios oficiales</h1>
      <p role="status" className={notice ? 'banner' : undefined}>
        {notice}
      </p>
      {error !== null && <ErrorState error={error} />}

      <section aria-labelledby="merchant-alerts">
        <h2 id="merchant-alerts">Avisos</h2>
        {!alerts && <Loading text="Consultando avisos…" />}
        {alerts && 'error' in alerts && <ErrorState error={alerts.error} onRetry={refresh} />}
        {alerts &&
          'data' in alerts &&
          (alerts.data.length === 0 ? (
            <p className="muted">No tienes avisos pendientes.</p>
          ) : (
            <ul className="merchant-price-list">
              {alerts.data.map((alert) => (
                <li key={`${alert.presentationId}:${alert.kind}`}>
                  <p>{alert.message}</p>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      aria-label={`${alert.kind === 'discrepancia' ? 'Corregir' : 'Editar'} precio de ${alert.productName}`}
                      onClick={() => {
                        choose(alert.presentationId, alert.productName);
                      }}
                    >
                      {alert.kind === 'discrepancia' ? 'Corregir precio' : 'Editar precio'}
                    </button>
                    {alert.kind !== 'discrepancia' && listed.length > 0 && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          reconfirmButton.current?.focus();
                        }}
                      >
                        Ir a reconfirmar precios
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section aria-labelledby="merchant-price-list">
        <h2 id="merchant-price-list">Mis precios</h2>
        {!prices && <Loading text="Consultando precios…" />}
        {prices && 'error' in prices && <ErrorState error={prices.error} onRetry={refresh} />}
        {prices &&
          'data' in prices &&
          (listed.length === 0 ? (
            <p className="muted">Aún no has publicado precios oficiales.</p>
          ) : (
            <>
              <button
                ref={reconfirmButton}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  void reconfirm();
                }}
              >
                Todos mis precios siguen igual
              </button>
              <ul className="merchant-price-list">
                {listed.map((item) => {
                  const label = productLabel(item.presentationId);
                  const freshness = FRESHNESS[item.freshness];
                  return (
                    <li key={item.presentationId}>
                      <h3>{label}</h3>
                      <p>
                        <strong>{formatCop(item.priceCop)}</strong>{' '}
                        <span className={`pill ${freshness.tone}`}>{freshness.label}</span>
                      </p>
                      <p className="muted">Confirmado el {dayInColombia(item.confirmedAt)}</p>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={busy}
                        aria-label={`Editar precio de ${label}`}
                        onClick={() => {
                          choose(item.presentationId);
                        }}
                      >
                        Editar precio
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ))}
      </section>

      <section aria-labelledby="merchant-editor">
        <h2 id="merchant-editor" ref={editor} tabIndex={-1}>
          Publicar o editar un precio
        </h2>
        <MerchantPriceEditor
          key={selection?.presentationId ?? 'new'}
          selection={selection}
          disabled={busy}
          onChoose={choose}
          onCancel={() => {
            setSelection(null);
          }}
          onSave={save}
        />
      </section>
      <section aria-labelledby="merchant-upload">
        <h2 id="merchant-upload">Cargar precios por CSV</h2>
        <MerchantPriceUpload disabled={busy} onUpload={update} />
      </section>
    </div>
  );
}
