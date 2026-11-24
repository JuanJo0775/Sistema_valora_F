import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { Field } from './Field';
import { waitText } from './formErrors';
import { withReturn } from './safeReturn';
import { longDate } from './scheduledDate';
import { useSession } from './session';
import './auth.css';

type Problem = { kind: 'password' } | { kind: 'email' } | { kind: 'other'; message: string };

// Mensajes claros y con salida para cada error de POST /v1/me/account-deletion.
export function problemOf(error: unknown): Problem {
  if (!(error instanceof ApiError)) {
    return { kind: 'other', message: 'Algo salió mal. Inténtalo de nuevo.' };
  }
  if (error.status === 403 && error.code === 'INVALID_PASSWORD') return { kind: 'password' };
  if (error.status === 403 && error.code === 'INVALID_CONFIRMATION') return { kind: 'email' };
  if (error.status === 403 && error.code === 'LAST_MODERATOR_CANNOT_DELETE') {
    return {
      kind: 'other',
      message:
        'Eres el único moderador y por eso tu cuenta no se puede eliminar todavía. Primero traspasa el rol de moderación a otra persona del equipo y vuelve a intentarlo.',
    };
  }
  if (error.status === 403 && error.code === 'MODERATOR_CANNOT_DELETE') {
    return {
      kind: 'other',
      message:
        'Tu cuenta es de moderación y no se puede eliminar todavía. Primero traspasa el rol a otra persona del equipo y vuelve a intentarlo.',
    };
  }
  if (error.status === 429) {
    return {
      kind: 'other',
      message: `Hiciste demasiados intentos. ${waitText(error.retryAfterSeconds)} Luego inténtalo de nuevo.`,
    };
  }
  if (error.status === 0) return { kind: 'other', message: error.message };
  if (error.status >= 500) {
    return {
      kind: 'other',
      message:
        'No pudimos programar la eliminación por un problema de Valora. Tu cuenta sigue activa; inténtalo de nuevo en unos minutos.',
    };
  }
  return {
    kind: 'other',
    message: 'No pudimos programar la eliminación. Tu cuenta sigue activa; inténtalo de nuevo.',
  };
}

// «Yo» › Ajustes › Eliminar mi cuenta. Pantalla propia, con contraseña y una confirmación
// explícita. La contraseña vive solo en el estado del formulario. Una cuenta creada con Google no
// tiene contraseña: confirma escribiendo su correo (confirmEmail) y con la casilla.
export function DeleteAccount() {
  const { session, endSession, reload } = useSession();
  const { pathname, search } = useLocation();
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  // Se recuerda al enviar: al programarse, la sesión local se cierra y ya no se sabe.
  const [hadPassword, setHadPassword] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLHeadingElement>(null);
  const checkId = useId();

  // Al aparecer un error el foco va a él (o a la contraseña, si fue la que falló).
  useEffect(() => {
    if (!problem) return;
    if (problem.kind === 'password' || problem.kind === 'email') {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    } else alertRef.current?.focus();
  }, [problem, attempt]);

  useEffect(() => {
    if (scheduledFor) finalRef.current?.focus();
  }, [scheduledFor]);

  if (scheduledFor) {
    return (
      <section className="profile">
        <div className="state delete-done" role="status">
          <h1 ref={finalRef} tabIndex={-1}>
            Tu cuenta quedó programada para eliminarse
          </h1>
          <p>
            Se eliminará el <strong>{longDate(scheduledFor)}</strong>, pero tienes 10 días para
            cambiar de opinión
            {hadPassword
              ? ': inicia sesión con tu correo y contraseña y podrás restaurarla. '
              : '. Para restaurarla, vuelve a entrar con Google durante los 10 días. '}
            Pasado ese plazo se elimina de forma definitiva.
          </p>
          <p className="muted">
            Cerramos tus sesiones. La canasta y los ajustes de este dispositivo siguen aquí; puedes
            seguir comparando sin cuenta.
          </p>
          <Link to="/" replace className="btn">
            Ir al inicio
          </Link>
        </div>
      </section>
    );
  }
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'unknown') return <ErrorState error={session.error} onRetry={reload} />;
  if (session.status === 'anonymous') {
    return <Navigate to={withReturn('/entrar', pathname + search)} replace />;
  }

  const hasPassword = session.hasPassword;
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!(hasPassword ? password : confirmEmail.trim()) || !understood || sending) return;
    setProblem(null);
    setSending(true);
    call(
      api.POST('/me/account-deletion', {
        body: hasPassword ? { password } : { confirmEmail: confirmEmail.trim() },
      }),
    )
      .then((result) => {
        setHadPassword(hasPassword);
        setScheduledFor(result.scheduledFor);
        // El servidor cerró todas las sesiones: la local también.
        endSession();
      })
      .catch((failure: unknown) => {
        setProblem(problemOf(failure));
        setAttempt((n) => n + 1);
        setSending(false);
      });
  };

  return (
    <form className="form delete-account" onSubmit={submit} noValidate ref={formRef}>
      <BackLink fallback="/yo/ajustes" />
      <h1>Eliminar mi cuenta</h1>
      <section aria-labelledby="se-borra" className="delete-list">
        <h2 id="se-borra">Qué se borra</h2>
        <ul>
          <li>Tu cuenta y tu correo.</li>
          <li>Tus sesiones abiertas, en todos tus dispositivos.</li>
          <li>Tus datos de acceso, como la contraseña.</li>
        </ul>
      </section>
      <section aria-labelledby="se-conserva" className="delete-list">
        <h2 id="se-conserva">Qué se conserva</h2>
        <ul>
          <li>
            Los precios que reportaste siguen ayudando a la comunidad, pero sin tu nombre ni tu
            correo.
          </li>
        </ul>
      </section>
      {session.role === 'comercio' && (
        <section aria-labelledby="tu-tienda" className="delete-list">
          <h2 id="tu-tienda">Si administras una tienda</h2>
          <ul>
            <li>
              Durante los 10 días de plazo tu tienda, sus precios oficiales y sus promociones siguen
              mostrándose. Si restauras la cuenta, vuelves como comercio y todo sigue como estaba.
            </li>
            <li>
              Pasado el plazo se borran tu registro como responsable de la tienda y todo lo que
              publicaste: sus precios oficiales y sus promociones dejan de mostrarse y no se pueden
              recuperar. La comparación vuelve a los reportes de la comunidad.
            </li>
            <li>
              La tienda queda sin responsable registrado. Qué pasa con ella después (por ejemplo,
              quién puede volver a administrarla) todavía no está definido.
            </li>
          </ul>
        </section>
      )}
      <section aria-labelledby="plazo" className="delete-list">
        <h2 id="plazo">Tienes 10 días para cambiar de opinión</h2>
        <p>
          Al confirmar, cerramos tus sesiones y la cuenta queda programada para eliminarse.{' '}
          {hasPassword
            ? 'Durante 10 días puedes iniciar sesión con tu correo y contraseña para restaurarla.'
            : 'Para restaurarla, vuelve a entrar con Google durante los 10 días.'}{' '}
          <strong>Pasado ese plazo se elimina de forma definitiva y no se puede deshacer.</strong>
        </p>
      </section>
      {session.role === 'moderador' && (
        <p className="banner warn">
          Tu cuenta es de moderación. Si eres la única persona moderadora, no podrás eliminarla
          hasta traspasar el rol a otra persona del equipo.
        </p>
      )}
      <div ref={alertRef} tabIndex={-1} role="alert" className="delete-alert">
        {problem?.kind === 'other' && <p className="field-error">{problem.message}</p>}
      </div>
      {hasPassword ? (
        <Field
          label="Tu contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onValue={(value) => {
            setPassword(value);
            if (problem?.kind === 'password') setProblem(null);
          }}
          error={
            problem?.kind === 'password'
              ? 'La contraseña no es correcta. Revísala e inténtalo de nuevo.'
              : undefined
          }
        />
      ) : (
        <>
          <p className="delete-google">
            <strong>Tu cuenta usa Google.</strong> Para eliminarla escribe tu correo.
          </p>
          <Field
            label="Escribe tu correo para confirmar"
            type="email"
            autoComplete="email"
            value={confirmEmail}
            onValue={(value) => {
              setConfirmEmail(value);
              if (problem?.kind === 'email') setProblem(null);
            }}
            error={
              problem?.kind === 'email' ? 'Ese correo no coincide con el de tu cuenta.' : undefined
            }
          />
        </>
      )}
      <label className="delete-confirm" htmlFor={checkId}>
        <input
          id={checkId}
          type="checkbox"
          checked={understood}
          onChange={(event) => {
            setUnderstood(event.target.checked);
          }}
        />
        <span>Entiendo que pasado el plazo no se puede deshacer</span>
      </label>
      <div className="actions delete-actions">
        <button
          type="submit"
          className="btn danger"
          disabled={!(hasPassword ? password : confirmEmail.trim()) || !understood || sending}
          aria-busy={sending || undefined}
        >
          {sending ? 'Programando…' : 'Eliminar mi cuenta definitivamente'}
        </button>
        <Link to="/yo/ajustes" className="btn ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
