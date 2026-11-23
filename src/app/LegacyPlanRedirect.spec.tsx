import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LegacyPlanRedirect } from './LegacyPlanRedirect';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p>{`${pathname}${search}|${hash}`}</p>;
}

const visit = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/canasta/plan" element={<LegacyPlanRedirect />} />
        <Route path="/canasta" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('la dirección vieja del plan de compra', () => {
  it('/canasta/plan lleva a /canasta', () => {
    visit('/canasta/plan');
    expect(screen.getByText('/canasta|')).toBeInTheDocument();
  });

  it('/canasta/plan#mis-planes lleva a las listas guardadas', () => {
    visit('/canasta/plan#mis-planes');
    expect(screen.getByText('/canasta?tab=guardadas|')).toBeInTheDocument();
  });

  it('otro ancla no cambia de pestaña', () => {
    visit('/canasta/plan#otra');
    expect(screen.getByText('/canasta|')).toBeInTheDocument();
  });
});
