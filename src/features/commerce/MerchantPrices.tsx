import { Link } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { restoreFocus } from '../../shared/focus';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { dayInColombia } from '../../shared/days';
import { formatCop } from '../../shared/money';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { RequireRole } from '../auth/RequireRole';
import { MerchantPriceEditor, type PriceSelection } from './MerchantPriceEditor';
import { MerchantStoreEditor } from './MerchantStoreEditor';
import { MerchantPromotions } from './MerchantPromotions';
import { MerchantPriceUpload } from './MerchantPriceUpload';
import './merchant-prices.css';

const TABS = [
  ['prices', 'Precios'],
  ['upload', 'Carga masiva'],
  ['promotions', 'Promociones'],
  ['store', 'Mi tienda'],
] as const;
type Tab = (typeof TABS)[number][0];
type Profile = components['schemas']['MerchantProfile'];
type Promotion = components['schemas']['MerchantPromotion'];

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
  const [tab, setTab] = useState<Tab>('prices');
  const [profile, setProfile] = useState<Outcome<Profile> | null>(null);
  const [promotions, setPromotions] = useState<Outcome<Promotion[]> | null>(null);
  const [prices, setPrices] = useState<Outcome<Price[]> | null>(null);
  const [alerts, setAlerts] = useState<Outcome<Alert[]> | null>(null);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<PriceSelection | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const editorSection = useRef<HTMLElement>(null);
  const hadSelection = useRef(false);

  // Al guardar o cancelar, el formulario de precio desaparece: el foco vuelve al buscador y no se
  // pierde en <body> (WCAG 2.4.3). El aviso del resultado solo toma el foco si este se perdió.
  useEffect(() => {
    if (selection) {
      hadSelection.current = true;
      return;
    }
    if (!hadSelection.current) return;
    hadSelection.current = false;
    editorSection.current?.querySelector('input')?.focus();
  }, [selection]);

  // El resultado de una acción recibe el foco: el botón que la pidió ya no existe o cambió.
  useEffect(() => {
    if (notice) restoreFocus(noticeRef.current);
  }, [notice]);

  const reconfirmButton = useRef<HTMLButtonElement>(null);
  const [askingReconfirm, setAskingReconfirm] = useState(false);

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

  useEffect(() => {
    const controller = new AbortController();
    call(api.GET('/commerce/me', { signal: controller.signal }))
      .then((data) => {
        if (!controller.signal.aborted) setProfile({ data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProfile({ error });
      });
    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (tab !== 'promotions') return;
    const controller = new AbortController();
    call(api.GET('/commerce/promotions', { signal: controller.signal }))
      .then(({ items }) => {
        if (!controller.signal.aborted) setPromotions({ data: items });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPromotions({ error });
      });
    return () => {
      controller.abort();
    };
  }, [tab, revision]);

  const merchant =
    profile && 'data' in profile && 'establishment' in profile.data ? profile.data : null;
  const listed = prices && 'data' in prices ? prices.data : [];
  const productLabel = (id: string) =>
    labels.get(id) ??
    (alerts && 'data' in alerts
      ? alerts.data.find((alert) => alert.presentationId === id)?.productName
      : undefined) ??
    'Producto nuevo (el nombre aparece en unos segundos)';

  const choose = (presentationId: string, label = productLabel(presentationId)) => {
    const price = listed.find((item) => item.presentationId === presentationId);
    setSelection({ presentationId, label, priceCop: price?.priceCop });
    setError(null);
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

  const editingListed =
    selection !== null && listed.some((item) => item.presentationId === selection.presentationId);
  const priceEditor = (current: PriceSelection | null) => (
    <MerchantPriceEditor
      key={current?.presentationId ?? 'new'}
      selection={current}
      disabled={busy}
      onChoose={choose}
      onCancel={() => {
        setSelection(null);
      }}
      onSave={save}
    />
  );

  return (
    <div className="merchant-prices">
      <BackLink fallback="/yo" />
      <header className="merchant-portal-header">
        <p className="eyebrow">Portal de comercios</p>
        <h1>{merchant?.establishment.name ?? 'Mi comercio'}</h1>
        {merchant?.status === 'verificado' && <span className="pill ok">Verificado</span>}
      </header>
      <dl className="merchant-metrics">
        <div>
          <dt>Precios publicados</dt>
          <dd>{prices && 'data' in prices ? listed.length : '—'}</dd>
        </div>
        <div>
          <dt>Avisos pendientes</dt>
          <dd>{alerts && 'data' in alerts ? alerts.data.length : '—'}</dd>
        </div>
      </dl>
      <nav className="merchant-tabs" aria-label="Portal de comercios">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className="btn ghost"
            onClick={() => {
              setTab(key);
              setNotice('');
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <p role="status" ref={noticeRef} tabIndex={-1} className={notice ? 'banner' : 'sr-only'}>
        {notice}
      </p>
      {error !== null && <ErrorState error={error} />}

      <div className="merchant-tab-content" hidden={tab !== 'prices'}>
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
                {askingReconfirm ? (
                  <div className="actions">
                    <p>
                      {`Esto renueva la vigencia de ${String(listed.length)} ${listed.length === 1 ? 'precio' : 'precios'}. ¿Confirmas?`}
                    </p>
                    <button
                      ref={reconfirmButton}
                      type="button"
                      className="btn"
                      disabled={busy}
                      autoFocus
                      onClick={() => {
                        setAskingReconfirm(false);
                        void reconfirm();
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => {
                        setAskingReconfirm(false);
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    ref={reconfirmButton}
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => {
                      setAskingReconfirm(true);
                    }}
                  >
                    Todos mis precios siguen igual
                  </button>
                )}
                <ul className="merchant-price-list">
                  {listed.map((item) => {
                    const label = productLabel(item.presentationId);
                    const freshness = FRESHNESS[item.freshness];
                    return (
                      <li key={item.presentationId} className="merchant-price-row">
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
                        {selection?.presentationId === item.presentationId && (
                          <div className="merchant-inline-editor">{priceEditor(selection)}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ))}
        </section>

        <section aria-labelledby="merchant-editor" ref={editorSection}>
          <h2 id="merchant-editor">Publicar o editar un precio</h2>
          {priceEditor(editingListed ? null : selection)}
        </section>
      </div>
      <div className="merchant-tab-content" hidden={tab !== 'upload'}>
        <section aria-labelledby="merchant-upload">
          <h2 id="merchant-upload">Cargar precios por CSV</h2>
          <MerchantPriceUpload disabled={busy} onUpload={update} />
        </section>
      </div>
      {tab === 'promotions' && (
        <section aria-labelledby="merchant-promotions">
          <h2 id="merchant-promotions">Promociones</h2>
          {!promotions && <Loading text="Consultando promociones…" />}
          {promotions && 'error' in promotions && (
            <ErrorState error={promotions.error} onRetry={refresh} />
          )}
          <MerchantPromotions
            items={promotions && 'data' in promotions ? promotions.data : undefined}
            prices={prices && 'data' in prices ? prices.data : undefined}
            label={productLabel}
            onChanged={refresh}
            onPrices={() => {
              setTab('prices');
            }}
          />
        </section>
      )}
      {tab === 'store' && (
        <section aria-labelledby="merchant-store">
          <h2 id="merchant-store">Mi tienda</h2>
          {!profile && <Loading text="Consultando tu tienda…" />}
          {profile && 'error' in profile && <ErrorState error={profile.error} />}
          {merchant && (
            <>
              <h3>{merchant.establishment.name}</h3>
              <p>Responsable: {merchant.responsibleName}</p>
              {merchant.verifiedAt && (
                <p className="muted">Verificada el {dayInColombia(merchant.verifiedAt)}</p>
              )}
              <Link className="btn ghost" to={`/tiendas/${merchant.establishment.id}`}>
                Ver ficha pública
              </Link>
              {merchant.status === 'verificado' && (
                <MerchantStoreEditor
                  key={merchant.establishment.id}
                  storeId={merchant.establishment.id}
                  onChanged={refresh}
                />
              )}
            </>
          )}
          {profile && 'data' in profile && !merchant && (
            <Link to="/comercios/registro">Consultar mi registro</Link>
          )}
        </section>
      )}
    </div>
  );
}
