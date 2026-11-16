import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { ModerationQueue } from './ModerationQueue';

export const item = (productName: string, reason: string, extra: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  reason,
  productName,
  establishmentName: 'Ara',
  reportedPriceCop: 1200,
  medianPriceCop: 4500,
  deviationPercent: -73,
  reportersCount: 2,
  createdAt: '2026-11-16T15:00:00Z',
  ...extra,
});

const queue = (...items: unknown[]): FakeReply => ({ status: 200, body: { items } });

const renderQueue = (routes: Record<string, FakeReply | FakeReply[]>) => {
  const api = stubApi({ 'GET /v1/auth/session': sessionAs('moderador'), ...routes });
  render(
    <MemoryRouter>
      <ModerationQueue />
    </MemoryRouter>,
  );
  return api;
};

const caseOf = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);

describe('precios en revisión', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada caso muestra el precio frente a la mediana, el motivo y cuántos lo marcaron', async () => {
    renderQueue({
      'GET /v1/moderation/queue': queue(
        item('Arroz Diana · 500 g', 'marcado'),
        item('Leche Colanta · 1 l', 'apelacion', {
          reportersCount: 0,
          appealNote: 'Lo vi en la góndola, el precio era ese.',
        }),
      ),
    });

    const rice = within(
      (await screen.findByText('Arroz Diana · 500 g')).closest('li') as HTMLElement,
    );
    expect(rice.getByText('Ara')).toBeInTheDocument();
    expect(rice.getByText('Reportado $1.200 · mediana $4.500 (−73 %)')).toBeInTheDocument();
    expect(rice.getByText('Marcado como dudoso por 2 cuentas')).toBeInTheDocument();
    const milk = caseOf('Leche Colanta · 1 l');
    expect(milk.getByText('Apelación')).toBeInTheDocument();
    expect(milk.getByText('«Lo vi en la góndola, el precio era ese.»')).toBeInTheDocument();
  });
});
