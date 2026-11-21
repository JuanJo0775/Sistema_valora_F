import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';

// Una sola consulta por carga de la app, guardada en memoria: entrar y crear cuenta la comparten.
// Si falla, se da por «sin proveedores» y el resto de la pantalla funciona igual.
let pending: Promise<{ google: boolean }> | null = null;

function loadProviders(): Promise<{ google: boolean }> {
  pending ??= call(api.GET('/auth/providers'))
    .then((body) => ({ google: body.google === true }))
    .catch(() => ({ google: false }));
  return pending;
}

// Solo para las pruebas: olvida lo consultado.
export function resetProviders() {
  pending = null;
}

export function useProviders(): { google: boolean } {
  const [providers, setProviders] = useState({ google: false });
  useEffect(() => {
    let current = true;
    void loadProviders().then((found) => {
      if (current) setProviders(found);
    });
    return () => {
      current = false;
    };
  }, []);
  return providers;
}
