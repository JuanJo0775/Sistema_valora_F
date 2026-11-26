import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { ModerationPanel } from './ModerationPanel';

vi.mock('../stores/StoreMap', () => ({ StoreMap: () => null }));

const owner = {
  responsibleName: 'Clara Ríos',
  nit: '900123456-7',
  phone: '3001234567',
  status: 'verificado',
  verifiedAt: '2026-11-20T12:00:00Z',
};
const base = {
  establishment: { id: 's1', name: 'La Rosa' },
  owner,
  createdAt: '2026-11-22T12:00:00Z',
};

function open(item: Record<string, unknown>) {
  stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'GET /v1/moderation/merchant-cases': { status: 200, body: { items: [{ ...base, ...item }] } },
  });
  render(
    <MemoryRouter initialEntries={['/moderacion?vista=comercios']}>
      <ModerationPanel />
    </MemoryRouter>,
  );
}

describe('quién disputa y cuántas denuncias lleva una tienda (H18)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('una disputa muestra los datos de quien disputa junto a los del dueño actual', async () => {
    open({
      id: 'd1',
      kind: 'disputa',
      reason: 'Otra cuenta, estando en la tienda, intentó registrarla.',
      challenger: {
        responsibleName: 'Juan Pérez',
        phone: '3109876543',
        nit: '800111222-3',
        requestedAt: '2026-11-21T15:00:00Z',
      },
    });
    const group = await screen.findByRole('group', { name: 'Quien disputa' });
    expect(within(group).getByText('Juan Pérez')).toBeInTheDocument();
    expect(within(group).getByText('3109876543')).toBeInTheDocument();
    expect(within(group).getByText('800111222-3')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dueño actual' })).toHaveTextContent('Clara Ríos');
  });

  it('una disputa sin datos de quien disputa lo dice, sin inventar nada', async () => {
    open({ id: 'd2', kind: 'disputa', reason: 'Disputa.', challenger: null });
    expect(
      await screen.findByText(
        'No hay datos de quien disputa: la disputa es anterior a que se guardaran.',
      ),
    ).toBeInTheDocument();
  });

  it('quien disputa sin NIT se muestra como «Sin NIT»', async () => {
    open({
      id: 'd3',
      kind: 'disputa',
      reason: 'Disputa.',
      challenger: {
        responsibleName: 'Ana',
        phone: '3100000000',
        requestedAt: '2026-11-21T15:00:00Z',
      },
    });
    const group = await screen.findByRole('group', { name: 'Quien disputa' });
    expect(within(group).getByText('Sin NIT')).toBeInTheDocument();
  });

  it('una denuncia dice cuántas lleva la tienda y de cuántas cuentas, sin identificarlas', async () => {
    open({
      id: 'n1',
      kind: 'denuncia',
      reason: 'El dueño no coincide.',
      reportCount: 3,
      distinctReporters: 2,
      firstReportedAt: '2026-11-18T12:00:00Z',
    });
    expect(
      await screen.findByText(/3 denuncias abiertas de 2 cuentas distintas/),
    ).toBeInTheDocument();
  });

  it('una denuncia aislada se distingue de un patrón', async () => {
    open({ id: 'n2', kind: 'denuncia', reason: 'Una.', reportCount: 1, distinctReporters: 1 });
    expect(await screen.findByText(/1 denuncia abierta de 1 cuenta/)).toBeInTheDocument();
  });
});
