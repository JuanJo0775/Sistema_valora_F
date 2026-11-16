import { type SyntheticEvent, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SelectField } from '../../shared/ui/SelectField';
import { Field } from '../auth/Field';
import { type Municipality, MUNICIPALITY_OPTIONS } from '../comparison/criteria';
import { readMunicipality } from '../comparison/lastMunicipality';
import { StoreMap } from '../stores/StoreMap';
import { STORE_TYPES } from '../stores/storeTypes';
import './proposals.css';

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
  const [received, setReceived] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!point) return;
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
        setError(failure);
      });
  };

  if (received) {
    return (
      <EmptyState title="Recibido" text="Aparecerá en el mapa cuando un moderador la apruebe." />
    );
  }
  return (
    <form className="form proposal" onSubmit={submit} noValidate>
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
      {error !== null && <ErrorState error={error} />}
      <button type="submit" className="btn">
        Enviar propuesta
      </button>
    </form>
  );
}
