import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { BasketPage } from './BasketPage';
import { BasketProvider } from './BasketProvider';

const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const MILK = '4a2d3b75-6d2f-4c9b-8e72-1b8c2f3d4e5f';

const item = (
  productId: string,
  productName: string,
  presentationId: string,
  label: string,
  quantity = 1,
  bought = false,
) => ({
  productId,
  productName,
  presentationId,
  presentationLabel: label,
  quantity,
  bought,
});
const rice = item(RICE, 'Arroz blanco', 'arroz-500g', '500 g', 2);
const milk = item(MILK, 'Leche entera', 'leche-1l', '1 l');

const renderBasket = (...items: ReturnType<typeof item>[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter>
        <BasketPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

const rowOf = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);

describe('mi canasta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('vacía invita a buscar productos', () => {
    stubApi({});
    renderBasket();

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar productos' })).toHaveAttribute('href', '/');
  });

  it('cada producto se ve con su presentación y su cantidad, y se cambia con − y +', () => {
    stubApi({});
    renderBasket(rice);
    const row = rowOf('Arroz blanco');

    expect(row.getByText('500 g')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: 'Agregar uno de Arroz blanco' }));
    expect(row.getByText('3')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
  });

  it('lo comprado se tacha, va al final y se puede quitar', () => {
    stubApi({});
    renderBasket(rice, milk);

    fireEvent.click(rowOf('Arroz blanco').getByRole('checkbox', { name: 'Comprado' }));

    const names = screen
      .getAllByRole('listitem')
      .map((row) => row.querySelector('strong')?.textContent);
    expect(names).toEqual(['Leche entera', 'Arroz blanco']);
    expect(screen.getByText('Arroz blanco').closest('li')).toHaveClass('bought');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar lo comprado' }));
    expect(screen.queryByText('Arroz blanco')).not.toBeInTheDocument();
  });
});
