import { type SyntheticEvent, useState } from 'react';
import { Link } from 'react-router';
import { api, call } from '../../shared/api';
import { askLocation } from '../../shared/location';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SelectField } from '../../shared/ui/SelectField';
import { Field } from '../auth/Field';
import { humanizeError } from './fieldLabels';
import { type Municipality, MUNICIPALITY_OPTIONS } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import { StoreMap } from '../stores/StoreMap';
import { STORE_TYPES } from '../stores/storeTypes';
import './proposals.css';
import { BackLink } from '../../shared/ui/BackLink';

type StoreType = components['schemas']['Establishment']['type'];
type Point = { lat: number; lng: number };

const TYPE_OPTIONS = (Object.keys(STORE_TYPES) as StoreType[]).map((value) => ({
  value,
  label: STORE_TYPES[value],
}));

// RF-005 (RN4, RN7): un reportante propone una tienda que no está. Se manda la ubicación de la
// tienda, nunca la de quien propone (EC-08); queda pendiente hasta que un moderador la aprueba.
export function ProposeStore() {
  const [name, setName] = useState('');
  const [type, setType] = useState<StoreType>('barrio');
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<Point | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState('');
  const [received, setReceived] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    // Lo que exige el contrato, dicho antes de enviar: el servidor vuelve a validarlo.
    const found =
      name.trim().length < 2
        ? 'Escribe el nombre de la tienda.'
        : !point
          ? 'Toca el mapa para marcar dónde queda la tienda.'
          : '';
    setProblem(found);
    if (found || !point) return;
    setError(null);
    call(
      api.POST('/establishment-proposals', {
        body: {
          name: name.trim(),
          type,
          ...point,
          municipality,
          ...(address.trim() ? { address: address.trim() } : {}),
        },
      }),
    )
      .then(() => {
        setReceived(true);
      })
      .catch((failure: unknown) => {
        setError(humanizeError(failure));
      });
  };

  if (received) {
    return (
      <EmptyState
        title="Recibido"
        focus
        text="Aparecerá en el mapa cuando un moderador la apruebe."
        action={
          <div className="actions">
            <Link to="/mis-aportes" className="btn">
              Ver mis aportes
            </Link>
            <Link to="/mapa" className="btn ghost">
              Volver al mapa
            </Link>
          </div>
        }
      />
    );
  }
  return (
    <form className="form proposal" onSubmit={submit} noValidate>
      <BackLink fallback="/mapa" />
      <h1>Sugerir una tienda</h1>
      <Field label="Nombre de la tienda" value={name} onValue={setName} />
      <SelectField label="Tipo" value={type} options={TYPE_OPTIONS} onChange={setType} />
      <SelectField
        label="Municipio"
        value={municipality}
        options={MUNICIPALITY_OPTIONS}
        onChange={setMunicipality}
      />
      <Field label="Dirección (opcional)" value={address} onValue={setAddress} required={false} />
      <p className="muted">Toca el mapa donde queda la tienda.</p>
      <StoreMap stores={[]} label="Ubicación de la tienda" onPick={setPoint} picked={point} />
      {/* Solo si la persona lo toca: su ubicación en ese momento es la de la tienda. */}
      <button
        type="button"
        className="btn ghost"
        aria-describedby="para-ubicacion-tienda"
        onClick={() => {
          setProblem('');
          askLocation()
            .then(setPoint)
            .catch(() => {
              setProblem('Activa la ubicación del navegador o toca el mapa donde queda la tienda.');
            });
        }}
      >
        Estoy en la tienda
      </button>
      <p id="para-ubicacion-tienda" className="muted">
        Solo marca dónde queda la tienda en el mapa. Tu ubicación no se guarda ni se publica.
      </p>
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      <button type="submit" className="btn">
        Enviar propuesta
      </button>
    </form>
  );
}
