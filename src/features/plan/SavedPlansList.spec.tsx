import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { SavedPlansList } from './SavedPlansList';
import { savePlan, toSavedPlan, type PlanDraft } from './savedPlan';

const draft: PlanDraft = {
  area: { kind: 'municipio', municipality: 'armenia' },
  stores: [],
  lines: [],
  summary: {
    stores: 2,
    productsCop: 13380,
    baselineCop: null,
    travel: null,
    deliveryCop: 0,
    netCop: null,
    missing: 0,
  },
};

describe('Mis planes guardados', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('no se muestra sin planes', () => {
    const { container } = render(
      <MemoryRouter>
        <SavedPlansList />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lista fecha, tiendas, total y enlace de cada plan', () => {
    const plan = toSavedPlan(draft, new Date('2026-11-17T15:00:00Z'));
    savePlan(plan);
    render(
      <MemoryRouter>
        <SavedPlansList />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Mis planes guardados' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /17 nov/ });
    expect(link).toHaveAttribute('href', `/canasta/plan/${plan.id}`);
    expect(link).toHaveTextContent('2 tiendas');
    expect(link).toHaveTextContent(/\$\s?13\.380/);
  });
});
