import { useSearchParams } from 'react-router';
import { MerchantCases } from './MerchantCases';
import { ModerationQueue } from './ModerationQueue';
import { ProductRequests } from './ProductRequests';
import { RoleChange } from './RoleChange';
import { StoreProposals } from './StoreProposals';
import './moderation.css';
import { BackLink } from '../../shared/ui/BackLink';

type View = 'precios' | 'tiendas' | 'productos' | 'roles' | 'comercios';

const VIEWS: { value: View; label: string }[] = [
  { value: 'precios', label: 'Precios' },
  { value: 'tiendas', label: 'Tiendas' },
  { value: 'productos', label: 'Productos' },
  { value: 'comercios', label: 'Comercios' },
  { value: 'roles', label: 'Roles' },
];

// #14: el panel del moderador. La vista elegida vive en la dirección (?vista=), para volver a ella.
export function ModerationPanel() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find(({ value }) => value === params.get('vista')) ?? VIEWS[0];
  if (!view) return null;
  return (
    <section className="moderation">
      <BackLink fallback="/yo" />
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
        {view.value === 'comercios' && <MerchantCases />}
        {view.value === 'roles' && <RoleChange />}
      </div>
    </section>
  );
}
