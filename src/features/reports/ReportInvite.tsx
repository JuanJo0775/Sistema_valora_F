import { useId } from 'react';
import { Link } from 'react-router';

// #66 (prototipo): en el Inicio, la invitación a registrar un precio visto en la tienda (RF-006).
export function ReportInvite() {
  const title = useId();
  return (
    <section className="report-invite" aria-labelledby={title}>
      <h2 id={title}>¿Viste un precio en la tienda?</h2>
      <p className="muted">Regístralo en segundos y ayuda a tu barrio a comparar.</p>
      <Link to="/registrar" className="btn ghost">
        Registrar precio
      </Link>
    </section>
  );
}
