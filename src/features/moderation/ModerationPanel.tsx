import { useSearchParams } from 'react-router';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ModerationQueue } from './ModerationQueue';
import { ProductRequests } from './ProductRequests';
import { StoreProposals } from './StoreProposals';
import './moderation.css';

type View = 'precios' | 'tiendas' | 'productos' | 'roles';

const VIEWS: { value: View; label: string; issue?: number }[] = [
  { value: 'precios', label: 'Precios' },
  { value: 'tiendas', label: 'Tiendas' },
  { value: 'productos', label: 'Productos' },
  { value: 'roles', label: 'Roles', issue: 58 },
];

// #14: el panel del moderador. La vista elegida vive en la dirección (?vista=), para volver a ella.
export function ModerationPanel() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find(({ value }) => value === params.get('vista')) ?? VIEWS[0];
  if (!view) return null;
  return (
    <section className="moderation">
      <h1>Moderación</h1>
      <div role="tablist" aria-label="Vistas de moderación" className="choices">
        {VIEWS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={view.value === value}
            aria-controls={`panel-${value}`}
            className="choice tab-choice"
            onClick={() => {
              setParams({ vista: value });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${view.value}`} aria-labelledby={`tab-${view.value}`}>
        {view.value === 'precios' && <ModerationQueue />}
        {view.value === 'tiendas' && <StoreProposals />}
        {view.value === 'productos' && <ProductRequests />}
        {view.value === 'roles' && (
          <EmptyState
            title={view.label}
            text={`Esta vista está en construcción (issue #${String(view.issue)}).`}
          />
        )}
      </div>
    </section>
  );
}
