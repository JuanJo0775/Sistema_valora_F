import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { sessionAs, stubApi } from '../../test/fakeApi';

const item = {
  presentationId: 'p1',
  establishmentId: 's1',
  priceCop: 2200,
  freshness: 'por_confirmar',
  confirmedAt: '2026-11-12T12:00:00Z',
};
const product = {
  id: 'product',
  name: 'Arroz',
  presentations: [{ id: 'p1', quantity: 500, unit: 'g', packCount: 1 }],
};
const prices = '/v1/commerce/prices';

function openPanel(overrides: Parameters<typeof stubApi>[0] = {}) {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('comercio'),
    'GET /v1/commerce/me': {
      status: 200,
      body: { status: 'verificado', establishment: { id: 's1', name: 'La Rosa' } },
    },
    'GET /v1/establishments/s1/prices': {
      status: 200,
      body: { prices: [{ presentationId: 'p1', productName: 'Arroz · 500 g' }] },
    },
    [`GET ${prices}`]: { status: 200, body: { items: [item] } },
    'GET /v1/commerce/alerts': { status: 200, body: { items: [] } },
    ...overrides,
  });
  window.history.pushState({}, '', '/comercios');
  render(<App />);
  return api;
}

describe('panel de precios oficiales (#166)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('publica un precio tras buscar y elegir una presentación del catálogo', async () => {
    const { calls } = openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [] } },
      'GET /v1/products': { status: 200, body: { items: [product] } },
      [`PUT ${prices}`]: { status: 200, body: item },
    });
    fireEvent.change(
      await screen.findByRole('searchbox', { name: 'Buscar producto o código de barras' }),
      {
        target: { value: 'Arroz' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el catálogo' }));
    // El campo no se deshabilita mientras busca: así no pierde el foco del teclado.
    expect(
      screen.getByRole('searchbox', { name: 'Buscar producto o código de barras' }),
    ).toBeEnabled();
    fireEvent.click(await screen.findByRole('button', { name: 'Arroz · 500 g' }));
    fireEvent.change(screen.getByLabelText('Precio oficial en pesos'), {
      target: { value: '2200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar precio' }));
    expect(await screen.findByText('Precio oficial publicado.')).toBeInTheDocument();
    // El formulario de precio desaparece al guardar: el foco vuelve al buscador, listo para el siguiente.
    expect(
      screen.getByRole('searchbox', { name: 'Buscar producto o código de barras' }),
    ).toHaveFocus();
    const request = calls.find(({ method, path }) => method === 'PUT' && path === prices);
    expect(request?.body).toBe(JSON.stringify({ presentationId: 'p1', priceCop: 2200 }));
    expect(request?.headers.get('X-CSRF-Token')).toBe('token-1');

    // El aviso de éxito es de esta acción: no sigue visible al pasar a otra sección.
    fireEvent.click(screen.getByRole('button', { name: 'Carga masiva' }));
    expect(screen.queryByText('Precio oficial publicado.')).not.toBeInTheDocument();
  });

  it('anuncia cuántos resultados dio la búsqueda de productos', async () => {
    openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [] } },
      'GET /v1/products': { status: 200, body: { items: [product] } },
    });
    fireEvent.change(
      await screen.findByRole('searchbox', { name: 'Buscar producto o código de barras' }),
      { target: { value: 'Arroz' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el catálogo' }));
    await screen.findByRole('button', { name: 'Arroz · 500 g' });

    const status = screen.getByText('1 resultado');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveClass('sr-only');
  });

  it('anuncia que no hubo resultados cuando la búsqueda no encuentra nada', async () => {
    openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [] } },
      'GET /v1/products': { status: 200, body: { items: [] } },
    });
    fireEvent.change(
      await screen.findByRole('searchbox', { name: 'Buscar producto o código de barras' }),
      { target: { value: 'Zzz' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el catálogo' }));

    expect(await screen.findByText('No encontramos resultados.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('muestra la vigencia y permite corregir el precio desde un aviso', async () => {
    const { calls } = openPanel({
      'GET /v1/commerce/alerts': {
        status: 200,
        body: {
          items: [
            {
              kind: 'discrepancia',
              presentationId: 'p1',
              productName: 'Arroz · 500 g',
              message: 'La comunidad reporta otro precio.',
            },
          ],
        },
      },
      [`PUT ${prices}`]: { status: 200, body: item },
    });
    expect(await screen.findByText('Por confirmar')).toBeInTheDocument();
    expect(screen.getByText('La comunidad reporta otro precio.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Corregir precio de Arroz · 500 g' }));
    const input = screen.getByLabelText('Precio oficial en pesos');
    expect(input).toHaveValue('2200');
    fireEvent.change(input, { target: { value: '2750' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }));
    await waitFor(() => {
      expect(calls.find(({ method, path }) => method === 'PUT' && path === prices)?.body).toBe(
        JSON.stringify({ presentationId: 'p1', priceCop: 2750 }),
      );
    });
  });

  it('reconfirma el conjunto solo después de confirmarlo y vuelve a consultar los precios y los avisos', async () => {
    const { calls } = openPanel({
      [`POST ${prices}/reconfirm`]: { status: 200, body: { reconfirmed: 1 } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Todos mis precios siguen igual' }));
    expect(calls.some(({ method }) => method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Precios reconfirmados: 1.')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.filter(({ path }) => path === '/v1/commerce/alerts')).toHaveLength(2);
    });
  });

  it('antes de reconfirmar dice cuántos precios renueva, con el foco en «Confirmar»', async () => {
    const { calls } = openPanel({
      [`POST ${prices}/reconfirm`]: { status: 200, body: { reconfirmed: 1 } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Todos mis precios siguen igual' }));

    expect(
      screen.getByText('Esto renueva la vigencia de 1 precio. ¿Confirmas?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByText('Esto renueva la vigencia de 1 precio. ¿Confirmas?'),
    ).not.toBeInTheDocument();
    expect(calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('envía el CSV como texto y presenta errores de fila con descarga para corregirlos', async () => {
    const csv = 'codigo_barras;precio\r\n12345678;2200\r\n01234567;no\r\n';
    const { calls } = openPanel({
      [`POST ${prices}/bulk`]: {
        status: 200,
        body: {
          published: 1,
          errors: [
            { row: 3, barcode: '01234567', code: 'INVALID_PRICE', message: 'Precio inválido.' },
          ],
        },
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Carga masiva' }));
    fireEvent.change(await screen.findByLabelText('Archivo CSV'), {
      target: { files: [new File([csv], 'precios.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar precios' }));
    expect(await screen.findByText('Filas publicadas: 1.')).toBeInTheDocument();
    expect(screen.getByText('Precio inválido.')).toBeInTheDocument();
    const download = screen.getByRole('link', { name: 'Descargar filas con errores' });
    expect(download).toHaveAttribute('download', 'precios-por-corregir.csv');
    expect(decodeURIComponent(download.getAttribute('href')?.split(',')[1] ?? '')).toBe(
      'codigo_barras;precio\r\n01234567;no\r\n',
    );
    const request = calls.find(({ path }) => path === `${prices}/bulk`);
    expect(request?.headers.get('Content-Type')).toMatch(/^text\/csv/);
    expect(request?.body).toBe(csv);
  });

  it('rechaza un precio fuera del rango del backend sin publicar', async () => {
    const { calls } = openPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar precio de Arroz · 500 g' }));
    fireEvent.change(screen.getByLabelText('Precio oficial en pesos'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/entre \$100 y \$5\.000\.000/);
    expect(calls.some(({ method }) => method === 'PUT')).toBe(false);
  });

  it('mantiene operativos los precios si falla la consulta de avisos', async () => {
    openPanel({
      'GET /v1/commerce/alerts': {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'No se pudieron consultar los avisos.' },
      },
    });
    expect(await screen.findByText('No se pudieron consultar los avisos.')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Todos mis precios siguen igual' }),
    ).toBeEnabled();
  });

  it('organiza el portal por secciones y muestra la tienda verificada', async () => {
    openPanel({ 'GET /v1/commerce/promotions': { status: 200, body: { items: [] } } });
    expect(await screen.findByRole('heading', { name: 'La Rosa' })).toBeInTheDocument();
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Precios' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('heading', { name: 'Cargar precios por CSV' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Promociones' }));
    expect(await screen.findByText('Aún no tienes promociones publicadas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mi tienda' }));
    expect(screen.getByRole('link', { name: 'Ver ficha pública' })).toHaveAttribute(
      'href',
      '/tiendas/s1',
    );
  });

  it('no consulta datos comerciales desde una cuenta reportante', async () => {
    const { calls } = openPanel({ 'GET /v1/auth/session': sessionAs('reportante') });
    expect(await screen.findByText('Esta sección es para cuentas de comercio')).toBeInTheDocument();
    expect(calls.some(({ path }) => path.startsWith('/v1/commerce/'))).toBe(false);
  });
});
