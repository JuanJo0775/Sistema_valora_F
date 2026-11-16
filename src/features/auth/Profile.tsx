import { Link } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { useSession } from './session';

export function Profile() {
  const session = useSession();
  if (session.status === 'active') {
    return <EmptyState title="Tu cuenta" text={`Entraste como ${session.role}.`} />;
  }
  return (
    <EmptyState
      title="Tu cuenta"
      text="Con una cuenta puedes registrar precios y ver tus aportes. Para comparar no la necesitas."
      action={
        <div className="actions">
          <Link to="/entrar" className="btn">
            Iniciar sesión
          </Link>
          <Link to="/crear-cuenta" className="btn ghost">
            Crear cuenta
          </Link>
        </div>
      }
    />
  );
}
