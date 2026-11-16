import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { ModerationQueue } from './ModerationQueue';

const item = (productName: string, reason: string, extra: Record<string, unknown> = {}) => ({
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

  const decide = async (name: string, decision: string, note: string) => {
    const row = within((await screen.findByText(name)).closest('li') as HTMLElement);
    fireEvent.click(row.getByRole('radio', { name: decision }));
    fireEvent.change(row.getByLabelText('Motivo de la decisión'), { target: { value: note } });
    fireEvent.click(row.getByRole('button', { name: 'Registrar decisión' }));
    return row;
  };

  it('se decide con un motivo y el caso sale de la cola', async () => {
    const rice = item('Arroz Diana · 500 g', 'marcado');
    const api = renderQueue({
      'GET /v1/moderation/queue': queue(rice),
      [`POST /v1/moderation/${rice.id}/decision`]: { status: 204 },
    });

    await decide(
      'Arroz Diana · 500 g',
      'Descartar',
      'El precio está muy por debajo de la mediana.',
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Decisión registrada: Arroz Diana · 500 g.',
    );
    expect(screen.queryByText('Arroz Diana · 500 g')).not.toBeInTheDocument();
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      decision: 'descartar',
      note: 'El precio está muy por debajo de la mediana.',
    });
  });

  it('con un motivo de menos de 10 letras lo pide sin enviar', async () => {
    const api = renderQueue({
      'GET /v1/moderation/queue': queue(item('Arroz Diana · 500 g', 'marcado')),
    });

    const row = await decide('Arroz Diana · 500 g', 'Aprobar', 'Está bien');

    expect(row.getByRole('alert')).toHaveTextContent('Escribe el motivo: al menos 10 letras.');
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it.each([
    ['OWN_REPORT', 'Es tu propio reporte: lo decide otro moderador.'],
    ['SAME_MODERATOR', 'Tú descartaste este reporte: su apelación la decide otro moderador.'],
  ])('con %s explica que lo decide otro moderador', async (code, message) => {
    const rice = item('Arroz Diana · 500 g', 'apelacion');
    renderQueue({
      'GET /v1/moderation/queue': queue(rice),
      [`POST /v1/moderation/${rice.id}/decision`]: {
        status: 409,
        body: { code, message: 'Conflicto.' },
      },
    });

    const row = await decide(
      'Arroz Diana · 500 g',
      'Aprobar',
      'El precio coincide con la góndola.',
    );

    expect(await row.findByRole('alert')).toHaveTextContent(message);
  });

  it('se filtra por motivo', async () => {
    const api = renderQueue({
      'GET /v1/moderation/queue': queue(item('Arroz Diana · 500 g', 'marcado')),
    });
    await screen.findByText('Arroz Diana · 500 g');

    fireEvent.change(screen.getByRole('combobox', { name: 'Motivo' }), {
      target: { value: 'apelacion' },
    });

    await vi.waitFor(() => {
      expect(api.requested.at(-1)?.searchParams.get('reason')).toBe('apelacion');
    });
  });

  it('sin casos pendientes lo dice', async () => {
    renderQueue({ 'GET /v1/moderation/queue': queue() });

    expect(
      await screen.findByRole('heading', { name: 'No hay precios en revisión' }),
    ).toBeInTheDocument();
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();
    render(
      <MemoryRouter>
        <ModerationQueue />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si la cola no carga muestra el error y permite reintentar', async () => {
    renderQueue({
      'GET /v1/moderation/queue': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        queue(item('Arroz Diana · 500 g', 'marcado')),
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Arroz Diana · 500 g')).toBeInTheDocument();
  });
});
