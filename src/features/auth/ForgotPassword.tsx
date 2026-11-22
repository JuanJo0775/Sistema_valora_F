import { Link, useLocation, useSearchParams } from 'react-router';
import { BackLink } from '../../shared/ui/BackLink';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { safeReturn, withReturn } from './safeReturn';
import './auth.css';

// «¿Olvidaste tu contraseña?»: pide el enlace por correo. El correo que se había escrito en «Entrar»
// llega por el estado del enrutador, no por la dirección (EC-08: ningún correo en la URL).
export function ForgotPassword() {
  const [params] = useSearchParams();
  const { state } = useLocation() as { state: { email?: unknown } | null };
  const volver = safeReturn(params.get('volver'));
  const email = typeof state?.email === 'string' ? state.email : '';
  return (
    <section className="form">
      <BackLink fallback="/entrar" />
      <h1>¿Olvidaste tu contraseña?</h1>
      <p className="muted">
        Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.
      </p>
      <ForgotPasswordForm initialEmail={email} />
      <p className="muted">
        ¿Ya la recordaste? <Link to={withReturn('/entrar', volver)}>Iniciar sesión</Link>
      </p>
    </section>
  );
}
