import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi } from '../../test/fakeApi';
import { MyReports } from './MyReports';

const report = (productName: string, status: string, extra: Record<string, unknown> = {}) => ({
  reportId: crypto.randomUUID(),
  productName,
  establishmentName: 'Ara',
  priceCop: 4500,
  priceType: 'normal',
  observedAt: '2026-11-16T15:00:00Z',
  status,
  ...extra,
});

const page = (items: unknown[], nextBefore?: string): FakeReply => ({
  status: 200,
  body: { items, ...(nextBefore ? { nextBefore } : {}) },
});

const renderMine = () =>
  render(
    <MemoryRouter>
      <MyReports />
    </MemoryRouter>,
  );

const rowOf = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);

describe('mis aportes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada aporte dice el producto, la tienda, el precio y su estado en palabras', async () => {
    stubApi({
      'GET /v1/me/reports': page([
        report('Banano', 'normal'),
        report('Arroz blanco', 'descartado', { priceType: 'oferta' }),
        report('Leche entera', 'apelacion_pendiente'),
      ]),
    });

    renderMine();

    expect(await screen.findByRole('heading', { name: 'Mis aportes' })).toBeInTheDocument();
    expect(rowOf('Banano').getByText('Ara · $4.500')).toBeInTheDocument();
    expect(rowOf('Banano').getByText('Vigente')).toBeInTheDocument();
    expect(rowOf('Arroz blanco').getByText('Ara · $4.500 · oferta')).toBeInTheDocument();
    expect(rowOf('Arroz blanco').getByText('Descartado')).toBeInTheDocument();
    expect(rowOf('Leche entera').getByText('Apelación en revisión')).toBeInTheDocument();
  });
});
