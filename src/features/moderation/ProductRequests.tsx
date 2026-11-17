import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { operations } from '../../shared/api/schema';
import { formatPresentation } from '../catalog/presentation';
import { ALREADY_DECIDED, CatalogDecision } from './CatalogDecision';
import { explainWith } from './explain';
import { PendingList } from './PendingList';

type Request =
  operations['listProductRequests']['responses'][200]['content']['application/json']['items'][number];

const explain = explainWith({
  404: ALREADY_DECIDED,
  BARCODE_TAKEN: 'Otro producto ya tiene ese código de barras: solo se puede rechazar.',
  UNKNOWN_PRODUCT: 'Ese producto ya no existe: elige otra decisión.',
  MIXED_UNIT_BASES:
    'La presentación no se mide igual que ese producto (peso, volumen o unidades): elige otra decisión.',
});

const load = () => call(api.GET('/moderation/product-requests')).then(({ items }) => items);

// #57 (RF-011 y RF-013): los productos que piden las personas esperan aquí la decisión de un
// moderador. Nunca dice quién lo pidió (EC-08).
export function ProductRequests() {
  const [categories, setCategories] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    let current = true;
    // Sin la lista de categorías, cada propuesta muestra el código de la suya.
    call(api.GET('/categories'))
      .then(({ items }) => {
        if (current) setCategories(Object.fromEntries(items.map(({ code, name }) => [code, name])));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  return (
    <PendingList
      load={load}
      empty="No hay productos propuestos"
      renderItem={(request: Request, done) => (
        <>
          <h2>{request.name}</h2>
          <p className="muted">
            {[
              request.brand,
              formatPresentation(request),
              categories[request.categoryCode] ?? request.categoryCode,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {request.barcode && <p>{`Código de barras ${request.barcode}`}</p>}
          {request.possibleDuplicates.length > 0 && (
            <p>
              {`Posibles duplicados: ${request.possibleDuplicates.map(({ name }) => name).join(', ')}`}
            </p>
          )}
          <CatalogDecision
            id={request.id}
            approveLabel="Aprobar como producto nuevo"
            duplicates={request.possibleDuplicates}
            send={(body) =>
              call(
                api.POST('/moderation/product-requests/{requestId}/decision', {
                  params: { path: { requestId: request.id } },
                  body,
                }),
              )
            }
            onDone={() => {
              done(request.name);
            }}
            explain={explain}
          />
        </>
      )}
    />
  );
}
