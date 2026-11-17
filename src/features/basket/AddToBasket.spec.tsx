import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { components } from '../../shared/api/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { AddToBasket } from './AddToBasket';
import { useBasket } from './basketContext';
import { BasketProvider } from './BasketProvider';

const rice: components['schemas']['Product'] = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
    { id: '0b3f8d21-2c3e-4f40-9b0c-1d2e3f4a5b6c', quantity: 1, unit: 'kg', packCount: 1 },
  ],
};

function BasketContents() {
  const { items } = useBasket();
  return (
    <p>{items.map((item) => `${item.presentationLabel} × ${String(item.quantity)}`).join(', ')}</p>
  );
}

const renderAdd = (product = rice) =>
  render(
    <BasketProvider>
      <MemoryRouter>
        <AddToBasket product={product} />
        <BasketContents />
      </MemoryRouter>
    </BasketProvider>,
  );

describe('agregar a la canasta', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('se elige la presentación y queda en la canasta (el aviso lo da BasketToast)', () => {
    renderAdd();

    fireEvent.click(screen.getByRole('radio', { name: '1 kg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(screen.getByText('1 kg × 1')).toBeInTheDocument();
  });

  it('la presentación sugerida llega marcada y es la que se agrega', () => {
    render(
      <BasketProvider>
        <MemoryRouter>
          <AddToBasket product={rice} suggestedPresentationId={rice.presentations[1]?.id} />
          <BasketContents />
        </MemoryRouter>
      </BasketProvider>,
    );

    expect(screen.getByRole('radio', { name: '1 kg' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '500 g' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(screen.getByText('1 kg × 1')).toBeInTheDocument();
  });

  it('sin sugerencia queda marcada la primera presentación, nunca ninguna', () => {
    renderAdd();

    expect(screen.getByRole('radio', { name: '500 g' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Agregar a la canasta' }),
    ).toHaveAccessibleDescription('Se agrega 500 g');
  });

  it('«Agregar a la canasta» es el botón primario', () => {
    renderAdd();

    expect(screen.getByRole('button', { name: 'Agregar a la canasta' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: 'Agregar a la canasta' })).not.toHaveClass('ghost');
  });

  it('con una sola presentación no hay que elegir', () => {
    renderAdd({ ...rice, presentations: rice.presentations.slice(0, 1) });

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(screen.getByText('500 g × 1')).toBeInTheDocument();
  });

  it('si ya está en la canasta, «Quitar de mi canasta» lo saca', () => {
    renderAdd({ ...rice, presentations: rice.presentations.slice(0, 1) });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));

    fireEvent.click(screen.getByRole('button', { name: 'Quitar de mi canasta' }));

    expect(screen.queryByText('500 g × 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a la canasta' })).toBeInTheDocument();
  });
});
