import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components, operations, paths } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { StoreMap } from '../stores/StoreMap';

type Store =
  paths['/establishments/{establishmentId}/prices']['get']['responses'][200]['content']['application/json']['establishment'];
type Patch =
  operations['updateMerchantEstablishment']['requestBody']['content']['application/json'];
type Receipt =
  operations['updateMerchantEstablishment']['responses'][200]['content']['application/json'];
type Hours = components['schemas']['OpeningHours'];
const DAYS = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
} satisfies Record<keyof Hours, string>;
const days = Object.keys(DAYS) as (keyof Hours)[];
const LABELS = {
  name: 'nombre',
  phone: 'teléfono',
  openingHours: 'horario',
  location: 'ubicación',
};
const describe = new Intl.ListFormat('es-CO');
const describeFields = (fields: (keyof typeof LABELS)[]) =>
  describe.format(fields.map((field) => LABELS[field]));

export function MerchantStoreEditor({
  storeId,
  onChanged,
}: {
  storeId: string;
  onChanged: () => void;
}) {
  const [result, setResult] = useState<{ store: Store } | { error: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    call(
      api.GET('/establishments/{establishmentId}/prices', {
        params: { path: { establishmentId: storeId } },
        cache: 'no-store',
        signal: controller.signal,
      }),
    )
      .then(({ establishment }) => {
        if (!controller.signal.aborted) setResult({ store: establishment });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ error });
      });
    return () => {
      controller.abort();
    };
  }, [storeId, attempt]);

  if (!result) return <Loading text="Consultando datos de la tienda…" />;
  if ('error' in result)
    return (
      <ErrorState
        error={result.error}
        onRetry={() => {
          setAttempt((value) => value + 1);
        }}
      />
    );
  return <StoreEditor store={result.store} onChanged={onChanged} />;
}

function StoreEditor({ store, onChanged }: { store: Store; onChanged: () => void }) {
  const [current, setCurrent] = useState(store);
  const [name, setName] = useState(store.name);
  const [phone, setPhone] = useState(store.phone ?? '');
  const [hours, setHours] = useState<Hours>(
    store.openingHours ?? {
      lunes: null,
      martes: null,
      miercoles: null,
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
    },
  );
  const [editHours, setEditHours] = useState(false);
  const [editLocation, setEditLocation] = useState(false);
  const [location, setLocation] = useState<Patch['location']>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setProblem('');
    setError(null);
    setReceipt(null);
    const patch: Patch = {};
    if (name.trim() !== current.name) patch.name = name.trim();
    if (phone.trim() !== (current.phone ?? '')) patch.phone = phone.trim();
    if (
      editHours &&
      days.some(
        (day) => JSON.stringify(hours[day]) !== JSON.stringify(current.openingHours?.[day] ?? null),
      )
    )
      patch.openingHours = hours;
    if (editLocation && location && (location.lat !== current.lat || location.lng !== current.lng))
      patch.location = location;
    if (Object.keys(patch).length === 0) {
      setProblem('Cambia algún dato antes de guardar.');
      return;
    }
    if (patch.phone !== undefined && !/^(3\d{9}|60\d{8})$/.test(patch.phone)) {
      setProblem('Escribe un celular de 10 dígitos o un fijo que empiece por 60.');
      return;
    }
    if (
      patch.openingHours &&
      Object.values(patch.openingHours).some((day) => day && day.opens >= day.closes)
    ) {
      setProblem('La hora de cierre debe ser posterior a la hora de apertura.');
      return;
    }

    lock.current = true;
    setBusy(true);
    try {
      const saved = await call(api.PATCH('/commerce/establishment', { body: patch }));
      setReceipt(saved);
      setCurrent({
        ...current,
        ...(saved.applied.includes('name') ? { name: name.trim() } : {}),
        ...(saved.applied.includes('phone') ? { phone: phone.trim() } : {}),
        ...(saved.applied.includes('openingHours') ? { openingHours: hours } : {}),
      });
      setEditLocation(false);
      setLocation(undefined);
      if (saved.inReview.includes('name')) setName(current.name);
      onChanged();
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="merchant-price-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label className="field">
        Nombre de la tienda
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          required
          minLength={2}
          maxLength={120}
          disabled={busy}
        />
      </label>
      <label className="field">
        Teléfono
        <input
          type="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
          }}
          maxLength={10}
          disabled={busy}
        />
      </label>
      <button
        className="btn ghost"
        type="button"
        aria-expanded={editHours}
        disabled={busy}
        onClick={() => {
          setEditHours(!editHours);
        }}
      >
        Editar horario
      </button>
      {editHours && (
        <fieldset className="merchant-store-hours" disabled={busy}>
          <legend>Horario semanal</legend>
          {days.map((key) => {
            const day = hours[key];
            const caption = DAYS[key];
            return (
              <fieldset key={key}>
                <legend>{caption}</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={day !== null}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? { opens: '08:00', closes: '18:00' }
                        : null;
                      setHours({ ...hours, [key]: next });
                    }}
                  />{' '}
                  Abre el {caption.toLowerCase()}
                </label>
                {day && (
                  <>
                    <label className="field">
                      Apertura del {caption.toLowerCase()}
                      <input
                        type="time"
                        required
                        value={day.opens}
                        onChange={(event) => {
                          setHours({ ...hours, [key]: { ...day, opens: event.target.value } });
                        }}
                      />
                    </label>
                    <label className="field">
                      Cierre del {caption.toLowerCase()}
                      <input
                        type="time"
                        required
                        value={day.closes}
                        onChange={(event) => {
                          setHours({ ...hours, [key]: { ...day, closes: event.target.value } });
                        }}
                      />
                    </label>
                  </>
                )}
              </fieldset>
            );
          })}
        </fieldset>
      )}
      <button
        className="btn ghost"
        type="button"
        aria-expanded={editLocation}
        disabled={busy}
        onClick={() => {
          setEditLocation(!editLocation);
        }}
      >
        Cambiar ubicación
      </button>
      {editLocation && (
        <>
          <p className="muted">Marca el punto de tu tienda. El cambio queda en revisión.</p>
          <StoreMap
            stores={[]}
            label="Ubicación de mi tienda"
            picked={location ?? current}
            onPick={setLocation}
          />
        </>
      )}
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      {receipt && (
        <div role="status">
          {receipt.applied.length > 0 && (
            <p>Cambios aplicados: {describeFields(receipt.applied)}.</p>
          )}
          {receipt.inReview.length > 0 && <p>En revisión: {describeFields(receipt.inReview)}.</p>}
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
