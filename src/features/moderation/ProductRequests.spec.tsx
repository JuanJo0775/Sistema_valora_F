import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { ProductRequests } from './ProductRequests';

const RICE_ID = '7f4e3d2c-1b0a-4c9d-8e7f-6a5b4c3d2e1f';

const request = (name: string, extra: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  name,
  categoryCode: 'granos',
  quantity: 500,
  unit: 'g',
  packCount: 1,
  possibleDuplicates: [],
  createdAt: '2026-11-16T15:00:00Z',
  ...extra,
});

const list = (...items: unknown[]): FakeReply => ({ status: 200, body: { items } });
const CATEGORIES: FakeReply = {
  status: 200,
  body: { items: [{ code: 'granos', name: 'Granos y cereales' }] },
};

const renderRequests = (routes: Record<string, FakeReply | FakeReply[]>) => {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'GET /v1/categories': CATEGORIES,
    ...routes,
  });
  render(
    <MemoryRouter>
      <ProductRequests />
    </MemoryRouter>,
  );
  return api;
};

const caseOf = async (name: string) =>
  within((await screen.findByRole('heading', { name })).closest('li') as HTMLElement);

const decide = (card: Awaited<ReturnType<typeof caseOf>>, decision: string) => {
  fireEvent.click(card.getByRole('radio', { name: decision }));
  fireEvent.change(card.getByRole('textbox', { name: 'Motivo de la decisión' }), {
    target: { value: 'Ya existe con otro nombre.' },
  });
  fireEvent.click(card.getByRole('button', { name: 'Registrar decisión' }));
};

describe('productos propuestos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada propuesta muestra su marca, su presentación, su categoría y su código de barras', async () => {
    renderRequests({
      'GET /v1/moderation/product-requests': list(
        request('Arroz Roa', { brand: 'Roa', barcode: '7702001001234' }),
        request('Gaseosa', { quantity: 350, unit: 'ml', packCount: 6, categoryCode: 'otra' }),
      ),
    });

    const rice = await caseOf('Arroz Roa');
    expect(await rice.findByText('Roa · 500 g · Granos y cereales')).toBeInTheDocument();
    expect(rice.getByText('Código de barras 7702001001234')).toBeInTheDocument();
    // Una categoría que no está en la lista se muestra por su código.
    expect((await caseOf('Gaseosa')).getByText('6 × 350 ml · otra')).toBeInTheDocument();
  });

  it('muestra los productos parecidos y solo con ellos se puede fusionar', async () => {
    renderRequests({
      'GET /v1/moderation/product-requests': list(
        request('Arroz Diana blanco', {
          possibleDuplicates: [{ id: RICE_ID, name: 'Arroz Diana' }],
        }),
      ),
    });

    const rice = await caseOf('Arroz Diana blanco');
    expect(rice.getByText('Posibles duplicados: Arroz Diana')).toBeInTheDocument();
    expect(
      rice.getAllByRole('radio').map(({ parentElement }) => parentElement?.textContent),
    ).toEqual(['Aprobar como producto nuevo', 'Fusionar con Arroz Diana', 'Rechazar']);
  });

  it('fusionar envía el producto elegido y quita la propuesta de la lista', async () => {
    const rice = request('Arroz Diana blanco', {
      possibleDuplicates: [{ id: RICE_ID, name: 'Arroz Diana' }],
    });
    const api = renderRequests({
      'GET /v1/moderation/product-requests': list(rice),
      [`POST /v1/moderation/product-requests/${rice.id}/decision`]: { status: 204 },
    });

    decide(await caseOf('Arroz Diana blanco'), 'Fusionar con Arroz Diana');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Decisión registrada: Arroz Diana blanco.',
    );
    expect(screen.queryByRole('heading', { name: 'Arroz Diana blanco' })).not.toBeInTheDocument();
    expect(JSON.parse(api.calls.find(({ method }) => method === 'POST')?.body ?? '{}')).toEqual({
      decision: 'fusionar',
      note: 'Ya existe con otro nombre.',
      mergeInto: RICE_ID,
    });
  });

  it.each([
    ['BARCODE_TAKEN', 409, 'Otro producto ya tiene ese código de barras: solo se puede rechazar.'],
    ['UNKNOWN_PRODUCT', 422, 'Ese producto ya no existe: elige otra decisión.'],
    [
      'MIXED_UNIT_BASES',
      422,
      'La presentación no se mide igual que ese producto (peso, volumen o unidades): elige otra decisión.',
    ],
    ['NOT_FOUND', 404, 'Esta propuesta ya no está pendiente: otro moderador la decidió.'],
  ])('si el servidor responde %s, lo explica', async (code, status, message) => {
    const rice = request('Arroz Diana blanco', {
      possibleDuplicates: [{ id: RICE_ID, name: 'Arroz Diana' }],
    });
    renderRequests({
      'GET /v1/moderation/product-requests': list(rice),
      [`POST /v1/moderation/product-requests/${rice.id}/decision`]: {
        status,
        body: { code, message: 'Rechazado.' },
      },
    });

    decide(await caseOf('Arroz Diana blanco'), 'Fusionar con Arroz Diana');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('sin propuestas lo dice', async () => {
    renderRequests({ 'GET /v1/moderation/product-requests': list() });

    expect(
      await screen.findByRole('heading', { name: 'No hay productos propuestos' }),
    ).toBeInTheDocument();
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();
    render(
      <MemoryRouter>
        <ProductRequests />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si la lista falla muestra el error y permite reintentar', async () => {
    renderRequests({
      'GET /v1/moderation/product-requests': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        list(request('Arroz Roa')),
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Arroz Roa' })).toBeInTheDocument();
  });
});
