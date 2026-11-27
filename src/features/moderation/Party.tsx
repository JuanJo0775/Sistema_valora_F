import { useId } from 'react';
import { dayInColombia } from '../../shared/days';

// Los datos de una de las partes de un caso (dueño actual, quien disputa, quien pide una tienda).
// Solo datos del comercio que la persona escribió; nunca su cuenta ni su correo (EC-08).
export function Party({
  title,
  name,
  nit,
  phone,
  status,
  since,
}: {
  title: string;
  name: string;
  nit: string | null;
  phone: string;
  status?: string;
  since?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <dl>
        <dt>Responsable</dt>
        <dd>{name}</dd>
        <dt>NIT</dt>
        <dd>{nit ?? 'Sin NIT'}</dd>
        <dt>Teléfono</dt>
        <dd>{phone}</dd>
        {status && (
          <>
            <dt>Estado</dt>
            <dd>{status}</dd>
          </>
        )}
        {since && (
          <>
            <dt>Desde</dt>
            <dd>{dayInColombia(since)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
