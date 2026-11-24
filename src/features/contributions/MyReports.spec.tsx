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
    // Ya está en Mis aportes: no se enlaza a sí misma y dice cómo apelar.
    expect(screen.queryByRole('link', { name: 'Ver mis aportes' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('pulsa «Apelar»');
  });

  // RF-013 RN4: apelar un descarte una sola vez y dentro del plazo.
  const discarded = report('Arroz blanco', 'descartado', {
    appealableUntil: '2026-11-23T17:00:00Z',
  });
  const appeal = (note: string) => {
    fireEvent.click(rowOf('Arroz blanco').getByRole('button', { name: 'Apelar' }));
    fireEvent.change(rowOf('Arroz blanco').getByLabelText('¿Por qué el precio era correcto?'), {
      target: { value: note },
    });
    fireEvent.click(rowOf('Arroz blanco').getByRole('button', { name: 'Enviar apelación' }));
  };

  it('un descarte se apela dentro del plazo y queda en revisión', async () => {
    const api = stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'GET /v1/me/reports': page([discarded, report('Banano', 'descartado')]),
      [`POST /v1/reports/${discarded.reportId}/appeal`]: { status: 202 },
    });
    renderMine();
    expect(await screen.findByText('Puedes apelar hasta el 23 nov')).toBeInTheDocument();
    expect(rowOf('Banano').queryByRole('button', { name: 'Apelar' })).not.toBeInTheDocument();

    appeal('Lo vi en la góndola ese día, con el precio marcado.');

    expect(await rowOf('Arroz blanco').findByText('Apelación en revisión')).toBeInTheDocument();
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      note: 'Lo vi en la góndola ese día, con el precio marcado.',
    });
  });

  it('con menos de 10 letras pide explicar más, sin enviar', async () => {
    const api = stubApi({
      'GET /v1/me/reports': page([discarded]),
    });
    renderMine();
    await screen.findByText('Arroz blanco');

    appeal('Era así');

    expect(rowOf('Arroz blanco').getByRole('alert')).toHaveTextContent(
      'Cuéntanos un poco más: al menos 10 letras.',
    );
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('el aviso de la apelación se liga a la caja del motivo y esta recibe el foco', async () => {
    stubApi({ 'GET /v1/me/reports': page([discarded]) });
    renderMine();
    await screen.findByText('Arroz blanco');

    appeal('Era así');

    const row = rowOf('Arroz blanco');
    const note = row.getByRole('textbox');
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAttribute('aria-describedby', row.getByRole('alert').id);
    expect(note).toHaveFocus();
  });

  it('si el servidor no acepta la apelación muestra por qué', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'GET /v1/me/reports': page([discarded]),
      [`POST /v1/reports/${discarded.reportId}/appeal`]: {
        status: 422,
        body: { code: 'APPEAL_WINDOW_CLOSED', message: 'Pasaron 7 días desde el descarte.' },
      },
    });
    renderMine();
    await screen.findByText('Arroz blanco');

    appeal('Lo vi en la góndola ese día, con el precio marcado.');

    expect(await rowOf('Arroz blanco').findByRole('alert')).toHaveTextContent(
      'Pasaron 7 días desde el descarte.',
    );
  });
});

describe('mis aportes: producto y estado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada aporte lleva a su producto y explica su estado', async () => {
    stubApi({
      'GET /v1/me/reports': page([
        report('Arroz Diana · 500 g', 'normal', { productId: 'p-arroz' }),
        report('Leche entera', 'en_revision', { productId: 'p-leche' }),
      ]),
    });

    renderMine();

    expect(await screen.findByRole('link', { name: 'Arroz Diana · 500 g' })).toHaveAttribute(
      'href',
      '/productos/p-arroz',
    );
    expect(screen.getByRole('link', { name: 'Leche entera' })).toHaveAttribute(
      'href',
      '/productos/p-leche',
    );
    expect(rowOf('Arroz Diana · 500 g').getByText('Ya cuenta en la comparación.')).toBeVisible();
    expect(rowOf('Leche entera').getByText('Un moderador lo está revisando.')).toBeVisible();
  });

  it('un aporte antiguo sin productId muestra el nombre sin enlace', async () => {
    stubApi({ 'GET /v1/me/reports': page([report('Banano', 'normal')]) });

    renderMine();

    expect(await screen.findByRole('heading', { name: 'Banano' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Banano' })).not.toBeInTheDocument();
  });
});
