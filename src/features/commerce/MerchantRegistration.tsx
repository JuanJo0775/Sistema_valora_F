import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import type { components, paths } from '../../shared/api/schema';
import { askLocation } from '../../shared/location';
import { BackLink } from '../../shared/ui/BackLink';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { SelectField } from '../../shared/ui/SelectField';
import { Field } from '../auth/Field';
import { RequireRole } from '../auth/RequireRole';
import { ResendVerification } from '../auth/ResendVerification';
import { useSession } from '../auth/session';
import '../auth/auth.css';
import { MUNICIPALITY_OPTIONS } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import { STORE_SEARCH_ID, type Store, StorePicker } from '../reports/StorePicker';
import { STORE_TYPES } from '../stores/storeTypes';
import './merchant-registration.css';

type Claim = paths['/commerce/claims']['post']['requestBody']['content']['application/json'];
type Receipt = paths['/commerce/claims']['post']['responses'][201]['content']['application/json'];
type Profile = components['schemas']['MerchantProfile'];
type NewStore = NonNullable<Claim['newEstablishment']>;
type Unlocks = components['schemas']['MerchantUnlocks'];

// Qué se envió: una tienda nueva o el reclamo de una del mapa. Al volver a consultar el estado
// (GET /commerce/me) el servidor no lo dice, y entonces el texto es neutro.
type ClaimKind = 'nueva' | 'reclamo' | undefined;

const TERMS_VERSION = '2026-11';
const STORE_TYPE_OPTIONS = (Object.keys(STORE_TYPES) as NewStore['type'][]).map((value) => ({
  value,
  label: STORE_TYPES[value],
}));
const UNLOCK_LABEL: Record<Unlocks[number], string> = {
  precios_oficiales: 'Publicar precios oficiales',
  carga_por_archivo: 'Cargar precios por archivo',
  promociones: 'Publicar promociones',
  avisos_de_precio: 'Recibir avisos de precio',
  datos_de_la_tienda: 'Actualizar los datos de la tienda',
};

export function MerchantRegistration() {
  const { session } = useSession();
  const isMerchant = session.status === 'active' && session.role === 'comercio';
  return (
    <RequireRole role={isMerchant ? 'comercio' : 'reportante'}>
      <RegistrationStatus isMerchant={isMerchant} />
    </RequireRole>
  );
}

function RegistrationStatus({ isMerchant }: { isMerchant: boolean }) {
  const { session, refreshRole } = useSession();
  const [query] = useSearchParams();
  const storeId = query.get('tienda');
  const [attempt, setAttempt] = useState(0);
  const [found, setFound] = useState<{ profile: Profile | null } | { error: unknown } | null>(null);
  const [receipt, setReceipt] = useState<(Receipt & { kind: ClaimKind }) | null>(null);
  const refreshedRole = useRef(false);
  const status =
    receipt?.status ?? (found && 'profile' in found ? found.profile?.status : undefined);

  useEffect(() => {
    if (status !== 'verificado' || isMerchant || refreshedRole.current) return;
    refreshedRole.current = true;
    refreshRole('comercio');
  }, [isMerchant, refreshRole, status]);

  useEffect(() => {
    const controller = new AbortController();
    call(api.GET('/commerce/me', { signal: controller.signal }))
      .then((profile) => {
        if (!controller.signal.aborted) setFound({ profile });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFound(error instanceof ApiError && error.status === 404 ? { profile: null } : { error });
      });
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const refresh = () => {
    setFound(null);
    setReceipt(null);
    setAttempt((current) => current + 1);
  };

  if (receipt)
    return (
      <ClaimStatus
        status={receipt.status}
        unlocks={receipt.unlocks}
        kind={receipt.kind}
        onRefresh={refresh}
      />
    );
  if (!found) return <Loading text="Consultando tu registro…" />;
  if ('error' in found) return <ErrorState error={found.error} onRetry={refresh} />;
  const { profile } = found;
  if (profile && 'establishment' in profile) {
    return <ClaimStatus status={profile.status} unlocks={profile.unlocks} onRefresh={refresh} />;
  }
  if (isMerchant) {
    return (
      <EmptyState
        level={1}
        title="No encontramos tu tienda"
        action={<Link to="/yo">Volver a Yo</Link>}
      />
    );
  }
  if (session.status === 'active' && session.emailVerificationRequired && !session.emailVerified) {
    return <VerifyMerchantEmail />;
  }
  return (
    <>
      {profile && (
        <p className="banner warn" role="status">
          {/* La nota de un moderador es interna (puede nombrar a quien denunció): al revocar no se muestra. */}
          {profile.status === 'revocado'
            ? 'Moderación revocó el registro de esta cuenta para esa tienda.'
            : `Tu tienda propuesta fue rechazada: ${profile.reason}`}
        </p>
      )}
      <ClaimForm
        key={storeId}
        storeId={storeId}
        onRegistered={(result, kind) => {
          setReceipt({ ...result, kind });
        }}
      />
    </>
  );
}

const PENDING_TEXT = {
  nueva:
    'Un moderador revisará la tienda antes de que aparezca en el mapa. Una vez aprobada, se verificará tu registro.',
  reclamo:
    'Un moderador revisará tu reclamo de esta tienda. Cuando lo apruebe, tu cuenta quedará verificada como dueña.',
  neutro: 'Un moderador revisará tu solicitud. Cuando la apruebe, se verificará tu registro.',
};

function ClaimStatus({
  status,
  unlocks,
  kind,
  onRefresh,
}: {
  status: Receipt['status'];
  unlocks: Unlocks | undefined;
  kind?: ClaimKind;
  onRefresh: () => void;
}) {
  const { session } = useSession();
  const pending = status === 'pre_aprobado';
  const canManage = !pending && session.status === 'active' && session.role === 'comercio';
  return (
    <section className="form merchant-registration" aria-live="polite">
      <h1>{pending ? 'Tu tienda quedó preaprobada' : 'Tu tienda quedó verificada'}</h1>
      <p>{pending ? PENDING_TEXT[kind ?? 'neutro'] : 'Tu cuenta ya está vinculada a la tienda.'}</p>
      {pending && unlocks && unlocks.length > 0 && (
        <>
          <h2>
            {kind === 'reclamo' ? 'Al aprobar tu reclamo podrás' : 'Al aprobar tu tienda podrás'}
          </h2>
          <ul>
            {unlocks.map((item) => (
              <li key={item}>{UNLOCK_LABEL[item]}</li>
            ))}
          </ul>
        </>
      )}
      <div className="actions">
        {pending && (
          <button type="button" className="btn" onClick={onRefresh}>
            Consultar estado
          </button>
        )}
        {canManage && (
          <Link className="btn" to="/comercios">
            Administrar mis precios
          </Link>
        )}
        <Link className="btn ghost" to="/yo">
          Volver a Yo
        </Link>
      </div>
    </section>
  );
}

function VerifyMerchantEmail() {
  return (
    <EmptyState
      level={1}
      title="Verifica tu correo para registrar tu tienda"
      text="Abre el enlace de verificación del correo y vuelve al registro."
      action={<ResendVerification />}
    />
  );
}

const CLAIM_ERROR: Record<string, string> = {
  NOT_AT_ESTABLISHMENT:
    'Tienes que estar en la tienda, a 50 m o menos, para comprobar tu presencia.',
  ESTABLISHMENT_HAS_OWNER:
    'La tienda ya tiene dueño registrado. El equipo de moderación revisará la disputa.',
  ACCOUNT_HAS_ESTABLISHMENT:
    'Esta cuenta ya tiene una tienda registrada o una solicitud pendiente.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de registrar una tienda.',
  REVOKED_FROM_ESTABLISHMENT:
    'El equipo de moderación revocó el registro de esta cuenta para esa tienda.',
  CHAIN_STORE_NOT_CLAIMABLE:
    'Las tiendas de cadena (como D1, Ara o Éxito) no se pueden reclamar: no tienen un dueño individual. Si tienes un negocio propio, regístralo como tienda nueva.',
  NOT_FOUND: 'La tienda ya no está disponible. Busca otra tienda en el mapa.',
};

// Campo que falla la validación y el elemento al que va el foco.
type Invalid = { field: 'store' | 'name' | 'responsible' | 'phone' | 'accepted'; message: string };
const FOCUS_ID: Record<Invalid['field'], string> = {
  store: STORE_SEARCH_ID,
  name: 'merchant-name',
  responsible: 'merchant-responsible',
  phone: 'merchant-phone',
  accepted: 'merchant-accepted',
};

function ClaimForm({
  storeId,
  onRegistered,
}: {
  storeId: string | null;
  onRegistered: (receipt: Receipt, kind: ClaimKind) => void;
}) {
  const [picked, setPicked] = useState<Store | null>(null);
  const [prefill, setPrefill] = useState<Store | null>(null);
  const [prefillFailed, setPrefillFailed] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<NewStore['type']>('barrio');
  const [municipality, setMunicipality] = useState<NewStore['municipality']>(readMunicipality);
  const [address, setAddress] = useState('');
  const [responsible, setResponsible] = useState('');
  const [phone, setPhone] = useState('');
  const [nit, setNit] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState('');
  const [invalid, setInvalid] = useState<Invalid | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const store = picked ?? prefill;
  // Un aviso de error describe el dato anterior: se retira apenas la persona lo corrige.
  const edit =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setProblem('');
      setInvalid(null);
      setError(null);
    };

  // Al fallar la validación el foco va al primer campo inválido, no se queda en el botón de enviar.
  useEffect(() => {
    if (invalid) document.getElementById(FOCUS_ID[invalid.field])?.focus();
  }, [invalid]);

  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!storeId) return;
    const controller = new AbortController();
    call(
      api.GET('/establishments/{establishmentId}/prices', {
        params: { path: { establishmentId: storeId } },
        signal: controller.signal,
      }),
    )
      .then(({ establishment }) => {
        if (!controller.signal.aborted) setPrefill(establishment);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPrefillFailed(true);
      });
    return () => {
      controller.abort();
    };
  }, [storeId]);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const target = isNew
      ? {
          newEstablishment: {
            name: name.trim(),
            type,
            municipality,
            ...(address.trim() ? { address: address.trim() } : {}),
          },
        }
      : store && { establishmentId: store.id };

    setProblem('');
    setInvalid(null);
    setError(null);
    if (!target || (isNew && name.trim().length < 2)) {
      setInvalid(
        isNew
          ? { field: 'name', message: 'Escribe el nombre de la tienda.' }
          : { field: 'store', message: 'Elige la tienda que quieres registrar.' },
      );
      return;
    }
    if (responsible.trim().length < 2) {
      setInvalid({ field: 'responsible', message: 'Escribe el nombre del responsable.' });
      return;
    }
    if (!/^(3\d{9}|60\d{8})$/.test(phone.trim())) {
      setInvalid({
        field: 'phone',
        message: 'Escribe un celular de 10 dígitos que empiece por 3 o un fijo con 60 y 8 dígitos.',
      });
      return;
    }
    if (!accepted) {
      setInvalid({ field: 'accepted', message: 'Lee y acepta las condiciones para comercios.' });
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    try {
      setLocating(true);
      const location = await askLocation({ enableHighAccuracy: true }).catch(() => null);
      setLocating(false);
      if (controller.signal.aborted) return;
      if (!location) {
        setProblem(
          'Sin ubicación no podemos comprobar que estás en la tienda. Activa el permiso e inténtalo de nuevo.',
        );
        return;
      }
      const result = await call(
        api.POST('/commerce/claims', {
          body: {
            ...target,
            responsibleName: responsible.trim(),
            phone: phone.trim(),
            ...(nit.trim() ? { nit: nit.trim() } : {}),
            acceptedTermsVersion: TERMS_VERSION,
            location,
          },
          signal: controller.signal,
        }),
      );
      controller.signal.throwIfAborted();
      onRegistered(result, isNew ? 'nueva' : 'reclamo');
    } catch (failure: unknown) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      inFlight.current = null;
      setLocating(false);
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const code = error instanceof ApiError ? error.code : '';
  const errorMessage = CLAIM_ERROR[code];

  return (
    <form className="form merchant-registration" onSubmit={(event) => void submit(event)}>
      <BackLink fallback="/yo" />
      <h1>Registrar mi tienda</h1>
      <fieldset disabled={busy} className="merchant-fields">
        {isNew ? (
          <>
            <Field
              id={FOCUS_ID.name}
              label="Nombre de la tienda"
              value={name}
              maxLength={120}
              onValue={edit(setName)}
              error={invalid?.field === 'name' ? invalid.message : undefined}
            />
            <SelectField
              label="Tipo de tienda"
              value={type}
              options={STORE_TYPE_OPTIONS}
              onChange={edit(setType)}
            />
            <SelectField
              label="Municipio"
              value={municipality}
              options={MUNICIPALITY_OPTIONS}
              onChange={edit(setMunicipality)}
            />
            <Field
              label="Dirección (opcional)"
              value={address}
              required={false}
              maxLength={200}
              onValue={edit(setAddress)}
            />
          </>
        ) : (
          <>
            {prefillFailed && (
              <p role="status">No pudimos cargar la tienda de origen. Búscala por su nombre.</p>
            )}
            <StorePicker
              value={store}
              onChange={edit(setPicked)}
              mode="claim"
              error={invalid?.field === 'store' ? invalid.message : undefined}
            />
          </>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setIsNew((current) => !current);
            setProblem('');
            setInvalid(null);
            setError(null);
          }}
        >
          {isNew ? 'Buscar una tienda del mapa' : 'Mi tienda no está en el mapa'}
        </button>
        <Field
          id={FOCUS_ID.responsible}
          label="Nombre del responsable"
          autoComplete="name"
          value={responsible}
          maxLength={80}
          onValue={edit(setResponsible)}
          error={invalid?.field === 'responsible' ? invalid.message : undefined}
        />
        <Field
          id={FOCUS_ID.phone}
          label="Teléfono"
          type="tel"
          autoComplete="tel-national"
          value={phone}
          maxLength={10}
          onValue={edit(setPhone)}
          error={invalid?.field === 'phone' ? invalid.message : undefined}
        />
        <Field
          label="NIT (opcional)"
          value={nit}
          required={false}
          maxLength={20}
          onValue={edit(setNit)}
          aria-describedby="merchant-nit"
        />
        <p id="merchant-nit" className="muted">
          Incluye el dígito de verificación. Si no tienes NIT, puedes registrar un comercio
          informal.
        </p>
        <details>
          <summary>Condiciones para comercios</summary>
          <ul>
            <li>
              Registra una sola tienda y hazlo únicamente si eres su dueño o responsable autorizado.
            </li>
            <li>
              Proporciona datos verdaderos y publica precios y promociones que correspondan a tu
              tienda.
            </li>
            <li>
              Valora usa los datos del responsable para gestionar el registro. Consulta la{' '}
              <Link to="/privacidad">política de datos y cookies</Link>.
            </li>
          </ul>
        </details>
        <label className="merchant-accept">
          <input
            id={FOCUS_ID.accepted}
            type="checkbox"
            aria-invalid={invalid?.field === 'accepted' ? true : undefined}
            aria-describedby={invalid?.field === 'accepted' ? 'merchant-accepted-error' : undefined}
            checked={accepted}
            onChange={(event) => {
              edit(setAccepted)(event.target.checked);
            }}
          />
          Acepto las condiciones para comercios
        </label>
        <p id="merchant-location" className="muted">
          {isNew
            ? 'Comparte tu ubicación desde la tienda. Ese punto se guarda para ubicar la tienda en el mapa si la aprueban.'
            : 'Comparte tu ubicación desde la tienda. Solo se usa una vez para verificar que estás a 50 m o menos y no se guarda.'}
        </p>
        {invalid?.field === 'accepted' && (
          <p id="merchant-accepted-error" role="alert" className="banner warn">
            {invalid.message}
          </p>
        )}
        {problem && (
          <p role="alert" className="banner warn">
            {problem}
          </p>
        )}
        {errorMessage && (
          <div className="banner warn">
            <p role="alert">{errorMessage}</p>
            {code === 'EMAIL_NOT_VERIFIED' && <ResendVerification />}
            {code === 'CHAIN_STORE_NOT_CLAIMABLE' && !isNew && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setIsNew(true);
                  setError(null);
                }}
              >
                Registrar una tienda nueva
              </button>
            )}
          </div>
        )}
        {error !== null && !errorMessage && <ErrorState error={error} />}
        <button type="submit" className="btn" aria-describedby="merchant-location">
          {busy
            ? locating
              ? 'Obteniendo tu ubicación…'
              : 'Registrando…'
            : 'Compartir mi ubicación y registrar'}
        </button>
      </fieldset>
    </form>
  );
}
