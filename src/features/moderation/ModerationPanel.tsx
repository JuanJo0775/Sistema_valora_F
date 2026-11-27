import { useSearchParams } from 'react-router';
import { useAvisos } from '../avisos/avisosContext';
import { MerchantCases } from './MerchantCases';
import { ModerationQueue } from './ModerationQueue';
import { ProductRequests } from './ProductRequests';
import { RoleChange } from './RoleChange';
import { VerifiedMerchants } from './VerifiedMerchants';
import { StoreProposals } from './StoreProposals';
import './moderation.css';
import { BackLink } from '../../shared/ui/BackLink';
import { Tabs } from '../../shared/ui/Tabs';

type View = 'precios' | 'tiendas' | 'productos' | 'roles' | 'comercios';

const VIEWS: { value: View; label: string }[] = [
  { value: 'precios', label: 'Precios' },
  { value: 'tiendas', label: 'Tiendas' },
  { value: 'productos', label: 'Productos' },
  { value: 'comercios', label: 'Comercios' },
  { value: 'roles', label: 'Roles' },
];

// El nombre de la pestaña y, si hay casos esperando, su número; el lector de pantalla lo oye en palabras.
function TabLabel({ label, count }: { label: string; count: number }) {
  if (count === 0) return label;
  return (
    <>
      {label}
      <span className="tab-count" aria-hidden="true">
        {count}
      </span>
      <span className="sr-only">{`, ${String(count)} ${count === 1 ? 'pendiente' : 'pendientes'}`}</span>
    </>
  );
}

// #14: el panel del moderador. La vista elegida vive en la dirección (?vista=), para volver a ella.
export function ModerationPanel() {
  const [params, setParams] = useSearchParams();
  const avisos = useAvisos();
  // ADR-043: los mismos números de la campana; Roles no tiene cola.
  const pending = (value: View): number =>
    avisos.kind === 'moderador' && value !== 'roles' ? (avisos.counts?.[value] ?? 0) : 0;
  const view = VIEWS.find(({ value }) => value === params.get('vista')) ?? VIEWS[0];
  if (!view) return null;
  return (
    <section className="moderation">
      <BackLink fallback="/yo" />
      <h1>Moderación</h1>
      <Tabs
        label="Vistas de moderación"
        className="choices"
        tabClassName="choice tab-choice"
        value={view.value}
        onChange={(value) => {
          setParams({ vista: value });
        }}
        tabs={VIEWS.map(({ value, label }) => ({
          id: value,
          label: <TabLabel label={label} count={pending(value)} />,
          content: <ViewContent view={value} />,
        }))}
      />
    </section>
  );
}

function ViewContent({ view }: { view: View }) {
  if (view === 'precios') return <ModerationQueue />;
  if (view === 'tiendas') return <StoreProposals />;
  if (view === 'productos') return <ProductRequests />;
  if (view === 'comercios') {
    return (
      <>
        <MerchantCases />
        <VerifiedMerchants />
      </>
    );
  }
  return <RoleChange />;
}
