import { useState } from 'react';
import { Link } from 'react-router';
import { formatCop } from '../../shared/money';
import { shortDay } from './planDates';
import { readPlans } from './savedPlan';

// «Mis planes guardados»: lo que hay en este teléfono. Sin planes no se muestra.
export function SavedPlansList() {
  const [plans] = useState(readPlans);
  if (plans.length === 0) return null;
  return (
    <section id="mis-planes" className="saved-plans" aria-labelledby="mis-planes-titulo">
      <h2 id="mis-planes-titulo">Mis planes guardados</h2>
      <ul className="plan-lines">
        {plans.map((plan) => (
          <li key={plan.id}>
            <Link to={`/canasta/plan/${plan.id}`}>
              {`${shortDay(plan.savedAt) ?? 'Plan'} · ${
                plan.summary.stores === 1 ? '1 tienda' : `${String(plan.summary.stores)} tiendas`
              } · ${formatCop(plan.summary.productsCop)} en productos`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
