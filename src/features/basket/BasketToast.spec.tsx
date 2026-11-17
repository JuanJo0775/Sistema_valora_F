import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBasket } from './basketContext';
import { BasketProvider } from './BasketProvider';
import { BasketToast } from './BasketToast';

// Un botón que agrega a la canasta, como las tarjetas del Inicio o el detalle.
function AddRice({ detail }: { detail?: string }) {
  const { add } = useBasket();
  return (
    <button
      type="button"
      onClick={() => {
        add(
          {
            productId: 'arroz',
            productName: 'Arroz blanco',
            presentationId: 'arroz-1kg',
            presentationLabel: '1 kg',
          },
          detail,
        );
      }}
    >
      Agregar arroz
    </button>
  );
}

const renderToast = (detail?: string) =>
  render(
    <BasketProvider>
      <MemoryRouter>
        <AddRice detail={detail} />
        <BasketToast />
      </MemoryRouter>
    </BasketProvider>,
  );

describe('aviso al agregar a la canasta', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('dice qué se agregó, dónde sale más barato, cuántos productos lleva y lleva a la canasta', () => {
    renderToast('Hasta 15 % menos comprándolo en Ahorra Más');

    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Arroz blanco agregado a tu canasta');
    expect(toast).toHaveTextContent('Hasta 15 % menos comprándolo en Ahorra Más');
    expect(toast).toHaveTextContent('Tu canasta: 1 producto');
    expect(within(toast).getByRole('link', { name: 'Ver canasta' })).toHaveAttribute(
      'href',
      '/canasta',
    );
  });

  it('sin agregar nada no hay aviso', () => {
    renderToast();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se va solo a los pocos segundos', () => {
    vi.useFakeTimers();
    renderToast();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se puede cerrar', () => {
    renderToast();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
