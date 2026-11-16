import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBasket } from './basketContext';
import { BasketProvider } from './BasketProvider';

const rice500 = {
  productId: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  productName: 'Arroz blanco',
  presentationId: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b',
  presentationLabel: '500 g',
};

// Lo que una pantalla ve y hace con la canasta.
function BasketProbe() {
  const { items, add } = useBasket();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          add(rice500);
        }}
      >
        Agregar arroz
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.presentationId}>
            {`${item.productName} · ${item.presentationLabel} × ${String(item.quantity)}`}
          </li>
        ))}
      </ul>
    </>
  );
}

const renderBasket = () =>
  render(
    <BasketProvider>
      <BasketProbe />
    </BasketProvider>,
  );

describe('estado de la canasta', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('agregar un producto lo deja en la canasta aunque se cierre la app', () => {
    const first = renderBasket();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));
    first.unmount();

    renderBasket();

    expect(screen.getByText('Arroz blanco · 500 g × 1')).toBeInTheDocument();
  });

  it('agregar la misma presentación otra vez suma uno a la cantidad', () => {
    renderBasket();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar arroz' }));

    expect(screen.getByText('Arroz blanco · 500 g × 2')).toBeInTheDocument();
  });
});
