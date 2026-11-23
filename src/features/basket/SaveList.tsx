import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router';
import type { PlanChoice } from '../plan/PlanPage';
import { areaOf, draftOf, unpricedLine } from '../plan/SavePlanButton';
import {
  defaultListName,
  MAX_PLANS,
  savePlanOnce,
  toSavedPlan,
  type PlanDraft,
} from '../plan/savedPlan';
import type { Area } from './useStoreTotals';
import type { BasketItem } from './basketContext';

type Outcome = 'saved' | 'same' | 'full' | 'failed';

// Una lista sin tiendas ni precios: solo los productos y cuántos de cada uno.
const bareDraft = (area: Area, items: BasketItem[]): PlanDraft => ({
  area: areaOf(area),
  stores: [],
  lines: items.map(unpricedLine),
  summary: {
    stores: 0,
    productsCop: 0,
    baselineCop: null,
    travel: null,
    deliveryCop: 0,
    netCop: null,
    missing: items.length,
  },
});

// «Guardar lista», dentro de «Dónde comprar»: la recomendación elegida (con sus tiendas y precios) o,
// si no hay ninguna con precios, solo la lista. El nombre ya viene escrito y se puede cambiar.
export function SaveList({
  choice,
  area,
  items,
  resultKey,
}: {
  choice?: PlanChoice;
  area: Area;
  // Lo que falta comprar.
  items: BasketItem[];
  // Cambia con la recomendación elegida: el resultado de otra no se queda a la vista.
  resultKey: string;
}) {
  const [name, setName] = useState(() => defaultListName(new Date().toISOString()));
  const [done, setDone] = useState<{ key: string; outcome: Outcome } | null>(null);
  const outcome = done?.key === resultKey ? done.outcome : null;

  const save = (event: SyntheticEvent) => {
    event.preventDefault();
    const draft = choice ? draftOf(choice, items) : bareDraft(area, items);
    const now = new Date();
    const listName = name.trim() || defaultListName(now.toISOString());
    const { outcome: result } = savePlanOnce(toSavedPlan(draft, now, listName));
    setDone({ key: resultKey, outcome: result });
  };

  return (
    <form className="save-list no-print" onSubmit={save}>
      <label className="field">
        Nombre de la lista
        <input
          value={name}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      {!choice && (
        <p className="muted">Se guardan los productos y las cantidades, sin tiendas ni precios.</p>
      )}
      <button type="submit" className="btn">
        {choice ? 'Guardar lista' : 'Guardar solo la lista'}
      </button>
      <div role="status" className="save-list-result">
        {(outcome === 'saved' || outcome === 'same') && (
          <p>
            <span>Lista guardada</span> <Link to="/canasta?tab=guardadas">Ver en Guardadas</Link>
          </p>
        )}
        {outcome === 'full' && (
          <p>
            {`Ya tienes ${String(MAX_PLANS)} listas guardadas. Borra una para guardar otra.`}{' '}
            <Link to="/canasta?tab=guardadas">Ir a Guardadas</Link>
          </p>
        )}
        {outcome === 'failed' && (
          <p>
            No se pudo guardar en este navegador (modo privado o sin espacio). Puedes compartirlo o
            imprimirlo.
          </p>
        )}
      </div>
    </form>
  );
}
