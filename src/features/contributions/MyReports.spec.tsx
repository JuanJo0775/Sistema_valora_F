import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { SessionProvider } from '../auth/SessionProvider';
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

  it('dice cuándo se vio cada precio y «Ver más» trae los anteriores', async () => {
    const api = stubApi({
      'GET /v1/me/reports': [
        page([report('Banano', 'normal')], '2026-11-16T15:00:00Z'),
        page([report('Panela', 'normal', { observedAt: '2026-11-10T20:00:00Z' })]),
      ],
    });
    renderMine();
    expect(await screen.findByText(/Visto el 16 nov/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    expect(await screen.findByText('Panela')).toBeInTheDocument();
    expect(screen.getByText('Banano')).toBeInTheDocument();
    expect(api.requested.at(-1)?.searchParams.get('before')).toBe('2026-11-16T15:00:00Z');
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('sin aportes invita a registrar el primer precio', async () => {
    stubApi({ 'GET /v1/me/reports': page([]) });

    renderMine();

    expect(
      await screen.findByRole('heading', { name: 'Todavía no has registrado precios' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar precio' })).toHaveAttribute(
      'href',
      '/registrar',
    );
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();

    renderMine();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si falla muestra el error y permite reintentar', async () => {
    stubApi({
      'GET /v1/me/reports': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        page([report('Banano', 'normal')]),
      ],
    });
    renderMine();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Banano')).toBeInTheDocument();
  });

  it('con la cuenta suspendida avisa hasta cuándo y que puede apelar', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante', '2026-11-20T17:00:00Z'),
      'GET /v1/me/reports': page([report('Banano', 'descartado')]),
    });

    render(
      <SessionProvider>
        <MemoryRouter>
          <MyReports />
        </MemoryRouter>
      </SessionProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 20 de noviembre de 2026. Mientras tanto puedes ver el estado de tus aportes y apelar.',
    );
  });
});
