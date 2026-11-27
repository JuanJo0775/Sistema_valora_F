import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    [`GET ${prices}`]: { status: 200, body: { items: [item], inReview: [] } },
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

  it('sugiere presentaciones mientras escribe, sin pulsar «Buscar en el catálogo»', async () => {
    const { calls } = openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [], inReview: [] } },
      'GET /v1/products': { status: 200, body: { items: [product] } },
    });
    const field = await screen.findByRole('searchbox', {
      name: 'Buscar producto o código de barras',
    });

    fireEvent.change(field, { target: { value: 'a' } });
    fireEvent.change(field, { target: { value: 'Arroz' } });

    expect(await screen.findByRole('button', { name: 'Arroz · 500 g' })).toBeInTheDocument();
    expect(calls.filter(({ path }) => path === '/v1/products')).toHaveLength(1);
  });

  it('al borrar lo escrito, las sugerencias desaparecen', async () => {
    openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [], inReview: [] } },
      'GET /v1/products': { status: 200, body: { items: [product] } },
    });
    const field = await screen.findByRole('searchbox', {
      name: 'Buscar producto o código de barras',
    });
    fireEvent.change(field, { target: { value: 'Arroz' } });
    await screen.findByRole('button', { name: 'Arroz · 500 g' });

    fireEvent.change(field, { target: { value: '' } });

    expect(screen.queryByRole('button', { name: 'Arroz · 500 g' })).not.toBeInTheDocument();
  });

  it('publica un precio tras buscar y elegir una presentación del catálogo', async () => {
    const { calls } = openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [], inReview: [] } },
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
    fireEvent.click(screen.getByRole('tab', { name: 'Carga masiva' }));
    expect(screen.queryByText('Precio oficial publicado.')).not.toBeInTheDocument();
  });

  it('usa el nombre del servidor en la lista y en «En revisión», sin pedir la lista pública (H3)', async () => {
    const named = { productName: 'Arroz blanco Diana', presentationLabel: '1 kg' };
    const { calls } = openPanel({
      [`GET ${prices}`]: {
        status: 200,
        body: {
          items: [{ ...item, ...named }],
          inReview: [
            {
              presentationId: 'p2',
              establishmentId: 's1',
              priceCop: 3000,
              submittedAt: '2026-11-13T12:00:00Z',
              productName: 'Aceite Gourmet',
              presentationLabel: '900 ml',
            },
          ],
        },
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Arroz blanco Diana · 1 kg' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aceite Gourmet · 900 ml' })).toBeInTheDocument();
    expect(screen.queryByText(/Producto nuevo/)).not.toBeInTheDocument();
    expect(calls.some(({ path }) => path === '/v1/establishments/s1/prices')).toBe(false);
  });

  it('sin los campos del servidor conserva el respaldo anterior', async () => {
    openPanel();
    expect(await screen.findByRole('heading', { name: 'Arroz · 500 g' })).toBeInTheDocument();
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
    // ADR-043: la campana del encabezado también consulta los avisos del comercio al abrir la app.
    const alertCalls = () => calls.filter(({ path }) => path === '/v1/commerce/alerts').length;
    const before = alertCalls();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Precios reconfirmados: 1.')).toBeInTheDocument();
    // Reconfirmar vuelve a consultar los avisos, una sola vez.
    await waitFor(() => {
      expect(alertCalls()).toBe(before + 1);
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
          inReview: [],
          errors: [
            { row: 3, barcode: '01234567', code: 'INVALID_PRICE', message: 'Precio inválido.' },
          ],
        },
      },
    });
    fireEvent.click(await screen.findByRole('tab', { name: 'Carga masiva' }));
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

  it('si el servidor dice que el precio es absurdo, muestra su mensaje junto al campo y deja el editor abierto', async () => {
    const message =
      'Tu precio de $300 está fuera de lo normal para esta presentación. Lo más barato que vemos es $2.000 y lo más caro $3.500. Revisa si faltan o sobran ceros.';
    openPanel({
      [`PUT ${prices}`]: { status: 422, body: { code: 'IMPLAUSIBLE_OFFICIAL_PRICE', message } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Editar precio de Arroz · 500 g' }));
    const input = screen.getByLabelText('Precio oficial en pesos');
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    // El mensaje es del campo (no un error genérico de la página) y el foco vuelve a él.
    expect(input).toHaveAccessibleDescription(message);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(screen.getByRole('button', { name: 'Guardar precio' })).toBeInTheDocument();
    expect(screen.queryByText('Precio oficial publicado.')).not.toBeInTheDocument();
    // Al corregir el valor, el aviso desaparece.
    fireEvent.change(input, { target: { value: '2300' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avisa que el precio quedó en revisión y que sigue vigente el anterior', async () => {
    openPanel({
      [`PUT ${prices}`]: { status: 200, body: { ...item, priceCop: 2300, status: 'en_revision' } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Editar precio de Arroz · 500 g' }));
    fireEvent.change(screen.getByLabelText('Precio oficial en pesos'), {
      target: { value: '2300' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }));
    expect(
      await screen.findByText(
        'Tu precio quedó en revisión: un moderador lo verá antes de publicarlo. Mientras tanto sigue vigente el anterior.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Precio oficial publicado.')).not.toBeInTheDocument();
  });

  it('si no había un precio anterior, el aviso de revisión no promete uno vigente', async () => {
    openPanel({
      [`GET ${prices}`]: { status: 200, body: { items: [], inReview: [] } },
      'GET /v1/products': { status: 200, body: { items: [product] } },
      [`PUT ${prices}`]: { status: 200, body: { ...item, status: 'en_revision' } },
    });
    fireEvent.change(
      await screen.findByRole('searchbox', { name: 'Buscar producto o código de barras' }),
      { target: { value: 'Arroz' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el catálogo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Arroz · 500 g' }));
    fireEvent.change(screen.getByLabelText('Precio oficial en pesos'), {
      target: { value: '2200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar precio' }));
    expect(
      await screen.findByText(
        'Tu precio quedó en revisión: un moderador lo verá antes de publicarlo.',
      ),
    ).toBeInTheDocument();
  });

  it('lista los precios en revisión con su nota, y no muestra la sección si no hay', async () => {
    openPanel({
      [`GET ${prices}`]: {
        status: 200,
        body: {
          items: [item],
          inReview: [
            {
              presentationId: 'p1',
              priceCop: 2300,
              submittedAt: '2026-11-23T15:00:00Z',
              status: 'en_revision',
            },
          ],
        },
      },
    });
    const section = (await screen.findByRole('heading', { name: 'En revisión' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(section).getByText('Arroz · 500 g')).toBeInTheDocument();
    expect(within(section).getByText('$2.300')).toBeInTheDocument();
    expect(within(section).getByText(/Enviado el /)).toBeInTheDocument();
    expect(within(section).getByText(/todavía no son públicos/)).toBeInTheDocument();
  });

  it('sin precios en revisión no muestra la sección «En revisión»', async () => {
    openPanel();
    await screen.findByText('Por confirmar');
    expect(screen.queryByRole('heading', { name: 'En revisión' })).not.toBeInTheDocument();
  });

  it('en la carga CSV separa las filas rechazadas de las que quedaron en revisión', async () => {
    const csv = 'codigo_barras;precio\r\n12345678;300\r\n87654321;2200\r\n';
    openPanel({
      [`POST ${prices}/bulk`]: {
        status: 200,
        body: {
          published: 0,
          inReview: [{ row: 3, barcode: '87654321', priceCop: 2200 }],
          errors: [
            {
              row: 2,
              barcode: '12345678',
              code: 'IMPLAUSIBLE_OFFICIAL_PRICE',
              message: 'Tu precio de $300 está fuera de lo normal.',
            },
          ],
        },
      },
    });
    fireEvent.click(await screen.findByRole('tab', { name: 'Carga masiva' }));
    fireEvent.change(await screen.findByLabelText('Archivo CSV'), {
      target: { files: [new File([csv], 'precios.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar precios' }));
    expect(await screen.findByText('Filas publicadas: 0.')).toBeInTheDocument();
    expect(screen.getByText('Tu precio de $300 está fuera de lo normal.')).toBeInTheDocument();
    const review = screen.getByRole('heading', { name: '1 fila quedó en revisión' }).parentElement;
    expect(review).not.toBeNull();
    const list = within(review as HTMLElement);
    expect(list.getByText('Fila 3')).toBeInTheDocument();
    expect(list.getByText(/87654321/)).toBeInTheDocument();
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
    expect(screen.getByRole('tab', { name: 'Precios' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.queryByRole('heading', { name: 'Cargar precios por CSV' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Promociones' }));
    expect(await screen.findByText('Aún no tienes promociones publicadas.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Mi tienda' }));
    expect(screen.getByRole('link', { name: 'Ver ficha pública' })).toHaveAttribute(
      'href',
      '/tiendas/s1',
    );
  });

  it('las secciones son pestañas WAI-ARIA con teclado y foco estable (H28)', async () => {
    openPanel({ 'GET /v1/commerce/promotions': { status: 200, body: { items: [] } } });
    const list = await screen.findByRole('tablist', { name: 'Secciones del portal de comercios' });
    expect(
      within(list)
        .getAllByRole('tab')
        .map(({ textContent }) => textContent),
    ).toEqual(['Precios', 'Carga masiva', 'Promociones', 'Mi tienda']);
    const precios = screen.getByRole('tab', { name: 'Precios' });
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([precios]);
    expect(screen.getByRole('tabpanel', { name: 'Precios' })).toHaveAttribute(
      'id',
      precios.getAttribute('aria-controls'),
    );

    precios.focus();
    fireEvent.keyDown(precios, { key: 'ArrowRight' });
    const carga = screen.getByRole('tab', { name: 'Carga masiva' });
    expect(carga).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Carga masiva' })).toBeVisible();

    fireEvent.keyDown(carga, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Mi tienda' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Mi tienda' }), { key: 'ArrowRight' });
    expect(precios).toHaveFocus();
    expect(precios).toHaveAttribute('aria-selected', 'true');
  });

  it('el aviso de reconfirmar sale bajo su botón y es el único status visible (H21, H27)', async () => {
    openPanel({ [`POST ${prices}/reconfirm`]: { status: 200, body: { reconfirmed: 1 } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Todos mis precios siguen igual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    const notice = await screen.findByText('Precios reconfirmados: 1.');
    expect(screen.getAllByRole('status')).toEqual([notice]);
    expect(within(screen.getByRole('region', { name: 'Mis precios' })).getByRole('status')).toBe(
      notice,
    );
    // El botón desapareció: el foco pasa al aviso, que es lo único que cambió.
    await waitFor(() => {
      expect(notice).toHaveFocus();
    });
  });

  it('el aviso de publicar un precio sale junto al formulario y reemplaza al anterior (H21, H27)', async () => {
    openPanel({
      [`PUT ${prices}`]: { status: 200, body: item },
      [`POST ${prices}/reconfirm`]: { status: 200, body: { reconfirmed: 1 } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Editar precio de Arroz · 500 g' }));
    fireEvent.change(screen.getByLabelText('Precio oficial en pesos'), {
      target: { value: '2300' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar precio' }));

    const published = await screen.findByText('Precio oficial publicado.');
    expect(
      within(screen.getByRole('region', { name: 'Publicar o editar un precio' })).getByRole(
        'status',
      ),
    ).toBe(published);
    expect(screen.getAllByRole('status')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Todos mis precios siguen igual' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Precios reconfirmados: 1.');
    expect(screen.queryByText('Precio oficial publicado.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('el aviso de la carga masiva sale bajo el formulario de la pestaña (H21)', async () => {
    openPanel({
      [`POST ${prices}/bulk`]: { status: 200, body: { published: 1, inReview: [], errors: [] } },
    });
    fireEvent.click(await screen.findByRole('tab', { name: 'Carga masiva' }));
    fireEvent.change(await screen.findByLabelText('Archivo CSV'), {
      target: { files: [new File(['codigo_barras;precio\r\n1;2200\r\n'], 'p.csv')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar precios' }));

    const notice = await screen.findByText('Filas publicadas: 1.');
    expect(screen.getAllByRole('status')).toEqual([notice]);
    expect(
      within(screen.getByRole('region', { name: 'Cargar precios por CSV' })).getByRole('status'),
    ).toBe(notice);
  });

  it('no consulta datos comerciales desde una cuenta reportante', async () => {
    const { calls } = openPanel({ 'GET /v1/auth/session': sessionAs('reportante') });
    expect(await screen.findByText('Esta sección es para cuentas de comercio')).toBeInTheDocument();
    expect(calls.some(({ path }) => path.startsWith('/v1/commerce/'))).toBe(false);
  });
});
