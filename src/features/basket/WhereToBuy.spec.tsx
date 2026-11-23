import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { directionsTo } from '../../shared/directions';
import { seriousViolations } from '../../test/axe';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubMatchMedia } from '../../test/matchMedia';
import {
  comparisonOf,
  far,
  locateAt,
  milk,
  MILK,
  near,
  offer,
  rice,
  RICE,
  salt,
  SALT,
  shop,
} from '../../test/planFixtures';
import { BasketPage } from './BasketPage';
import { BasketProvider } from './BasketProvider';

// «Dónde comprar» dentro de la canasta: recomendaciones que calcula el sistema y la persona elige.
// Tiendas A y B: arroz×2 y leche×1. Una tienda: B = $8.000 (A = $9.000); arroz en A y leche en B = $7.000.
const routesFor = (s: typeof far) => ({
  ...comparisonOf(RICE, offer(s.a, 'arroz-500g', 2000), offer(s.b, 'arroz-500g', 2500)),
  ...comparisonOf(MILK, offer(s.a, 'leche-1l', 5000), offer(s.b, 'leche-1l', 3000)),
});

const renderBasket = (...items: (typeof rice)[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter>
        <BasketPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

const panel = async () =>
  within(await screen.findByRole('complementary', { name: 'Dónde comprar' }));
// Las tarjetas de recomendación (no los radios de «¿Cuánto te cuesta ir?»).
const cards = (side: Awaited<ReturnType<typeof panel>>) =>
  within(side.getByRole('radiogroup', { name: 'Recomendaciones' })).getAllByRole('radio');
const pick = (name: string) => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

describe('canasta: dónde comprar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('es un solo panel con tarjetas de recomendación; sin ubicación, la más barata y todo en una tienda', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(side.getByRole('heading', { name: 'Dónde comprar' })).toBeInTheDocument();
    expect(side.getByRole('radiogroup', { name: 'Recomendaciones' })).toBeInTheDocument();
    expect(cards(side)).toHaveLength(2);
    expect(side.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    expect(side.getByRole('radio', { name: 'Todo en una tienda' })).not.toBeChecked();
    expect(side.queryByRole('radio', { name: 'La más cercana' })).not.toBeInTheDocument();
    expect(side.queryByRole('radio', { name: /1 tienda|2 tiendas|3 tiendas/ })).toBeNull();
    expect(screen.getAllByRole('complementary')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('cada tarjeta dice total, tiendas y una frase de lo que se gana y se paga', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    const cheapest = (await side.findByRole('radio', { name: 'La más barata' })).closest('label');
    expect(cheapest).toHaveTextContent('$7.000');
    expect(cheapest).toHaveTextContent('Tienda ATienda B');
    expect(cheapest).toHaveTextContent('Ahorras $1.000.');
    expect(cheapest).toHaveTextContent(
      /Estas dos tiendas tienen todos tus productos, pero están separadas por \d,\d km \(≈ \d+ min a pie\)\. Tú decides si te desplazas\./,
    );
    const single = side.getByRole('radio', { name: 'Todo en una tienda' }).closest('label');
    expect(single).toHaveTextContent('$8.000');
    expect(single).toHaveTextContent('Cuesta $1.000 más, pero compras en un solo lugar.');
  });

  it('sin ubicación avisa que no sabe cuál es la más cercana', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(side.getByText('Comparte tu ubicación para ver la más cercana.')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('«Todo en una tienda» conserva la tarjeta naranja de siempre; la más barata muestra el reparto', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(side.queryByRole('heading', { name: 'Compra todo en' })).not.toBeInTheDocument();
    expect(side.getAllByRole('heading', { level: 3, name: /^Tienda / })).toHaveLength(2);
    expect(side.getByText('Ahorras $1.000 frente a comprar todo en Tienda B')).toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Cómo llegar a Tienda A' })).toHaveAttribute(
      'href',
      directionsTo(far.a),
    );

    pick('Todo en una tienda');
    expect(side.getByRole('heading', { name: 'Compra todo en' })).toBeInTheDocument();
    expect(
      side.getAllByText('Tienda B').some((name) => name.classList.contains('cheapest-store-name')),
    ).toBe(true);
    expect(side.getByText('Tiene 2 de 2 productos.')).toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Cómo llegar a Tienda B' })).toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Ver el plan completo y guardarlo' })).toHaveAttribute(
      'href',
      '/canasta/plan',
    );
    expect(side.queryByRole('button', { name: /Guardar plan/ })).not.toBeInTheDocument();
  });

  it('el traslado va plegado y es «estimado»; rodeo y velocidad ya no se muestran', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    const fold = side.getByText('Traslado y domicilio (estimado)').closest('details');
    expect(fold).not.toHaveAttribute('open');
    expect(
      within(fold as HTMLElement).getByText(
        'Cómo estimamos esto: contamos 1,3 veces la distancia en línea recta, caminando a 4,5 km/h.',
      ),
    ).toBeInTheDocument();
    expect(fold).not.toHaveTextContent('$');
    expect(side.queryByLabelText('Factor de rodeo')).not.toBeInTheDocument();
    expect(side.queryByLabelText('Velocidad a pie (km/h)')).not.toBeInTheDocument();
    expect(side.queryByText('Cómo cuentas el traslado')).not.toBeInTheDocument();
    expect(side.queryByText('Supuestos del traslado')).not.toBeInTheDocument();
  });

  it('«¿Cuánto te cuesta ir?» va plegada, sin pesos por defecto, y no se pierde al cambiar de tarjeta', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    const section = side.getByText('¿Cuánto te cuesta ir?').closest('details') as HTMLElement;
    expect(section).not.toHaveAttribute('open');
    expect(within(section).getByRole('radio', { name: 'Voy a pie' })).toBeChecked();
    expect(within(section).queryByLabelText(/COP/)).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('radio', { name: 'Pago pasaje' }));
    expect(within(section).getByLabelText('Pasaje por viaje (COP)')).toHaveValue(null);
    fireEvent.change(within(section).getByLabelText('Pasaje por viaje (COP)'), {
      target: { value: '2500' },
    });
    pick('Todo en una tienda');
    pick('La más barata');

    expect(within(section).getByRole('radio', { name: 'Pago pasaje' })).toBeChecked();
    expect(within(section).getByLabelText('Pasaje por viaje (COP)')).toHaveValue(2500);
    fireEvent.click(within(section).getByRole('radio', { name: 'Gasto por km' }));
    expect(within(section).getByLabelText('Gasto por km (COP)')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('radio', { name: 'Voy a pie' }));
    expect(within(section).getByText(/solo kilómetros y minutos/)).toBeInTheDocument();
  });

  it('sin ubicación no habla de trayecto desde casa, solo de la distancia entre tiendas', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(
      side.getByText('Sin tu ubicación no estimamos el trayecto desde tu casa'),
    ).toBeInTheDocument();
    expect(side.getByText(/Distancia entre tiendas/)).toBeInTheDocument();
    expect(side.getByText('Sin tu ubicación, el neto no cuenta el traslado.')).toBeInTheDocument();
  });

  it('con ubicación suma «La más cercana», calcula la distancia aquí y nunca manda lat ni lng', async () => {
    locateAt(4.53, -75.6811);
    const api = stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    const nearest = (await side.findByRole('radio', { name: 'La más cercana' })).closest('label');
    expect(nearest).toHaveTextContent('Tienda A · a 400 m (≈ 7 min a pie)');
    expect(nearest).toHaveTextContent('Cuesta $2.000 más, pero está a 400 m.');
    expect(nearest).toHaveTextContent('Puede no ser la más barata.');
    expect(side.getByRole('radio', { name: 'La más barata' })).toBeInTheDocument();
    expect(side.queryByText('Comparte tu ubicación para ver la más cercana.')).toBeNull();
    expect(api.requested).toHaveLength(2);
    expect(api.requested.some((u) => u.searchParams.has('lat') || u.searchParams.has('lng'))).toBe(
      false,
    );
    pick('La más barata');
    expect(await side.findByText(/Traslado extra estimado/)).toBeInTheDocument();
    expect(side.getByText(/Neto estimado/)).toBeInTheDocument();
    expect(api.requested).toHaveLength(2);
  });

  it('si la persona está en la tienda, dice «a pasos de ti» en vez de «a 0 m»', async () => {
    locateAt(4.5336, -75.6811);
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    const nearest = (await side.findByRole('radio', { name: 'La más cercana' })).closest('label');
    expect(nearest).toHaveTextContent('Tienda A · a pasos de ti');
    expect(nearest).toHaveTextContent('pero está a pasos de ti.');
    expect(nearest).not.toHaveTextContent(/a 0 m/);
  });

  it('fusiona las etiquetas cuando la más barata es también la más cercana', async () => {
    locateAt(4.53, -75.6811);
    stubApi({
      ...comparisonOf(RICE, offer(near.a, 'arroz-500g', 1000), offer(near.b, 'arroz-500g', 2500)),
      ...comparisonOf(MILK, offer(near.a, 'leche-1l', 3000), offer(near.b, 'leche-1l', 3500)),
    });
    renderBasket(rice, milk);

    const side = await panel();
    expect(
      await side.findByRole('radio', { name: 'La más barata y la más cercana' }),
    ).toBeChecked();
    expect(cards(side)).toHaveLength(1);
  });

  it('el interruptor de domicilio resta del neto y deja el texto fijo; el dato se conserva al cambiar de tarjeta', async () => {
    locateAt(4.53, -75.6811);
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    await waitFor(() => {
      expect(side.getByText('Neto estimado: ahorras $1.000')).toBeInTheDocument();
    });
    const [first] = side.getAllByRole('group', { name: /Tienda/ });
    fireEvent.click(within(first as HTMLElement).getByLabelText('Me lo llevan a casa'));
    fireEvent.change(within(first as HTMLElement).getByLabelText('¿Cuánto cobra el domicilio?'), {
      target: { value: '5000' },
    });

    expect(
      side.getByText(
        'Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con la tienda.',
      ),
    ).toBeInTheDocument();
    expect(side.getByText(/Domicilio estimado: \$5\.000/)).toBeInTheDocument();
    expect(side.getByText('Con estos supuestos, dividir no te conviene')).toBeInTheDocument();

    pick('Todo en una tienda');
    pick('La más barata');
    expect(side.getByLabelText('¿Cuánto cobra el domicilio?')).toHaveValue(5000);
  });

  it('las flechas del teclado cambian de tarjeta', async () => {
    locateAt(4.53, -75.6811);
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    const cheapest = await side.findByRole('radio', { name: 'La más barata' });
    cheapest.focus();
    fireEvent.keyDown(cheapest, { key: 'ArrowRight' });
    expect(side.getByRole('radio', { name: 'Todo en una tienda' })).toBeChecked();
    expect(side.getByRole('radio', { name: 'Todo en una tienda' })).toHaveFocus();
    fireEvent.keyDown(side.getByRole('radio', { name: 'Todo en una tienda' }), {
      key: 'ArrowDown',
    });
    expect(side.getByRole('radio', { name: 'La más cercana' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: 'La más cercana' }), { key: 'ArrowRight' });
    expect(side.getByRole('radio', { name: 'La más barata' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: 'La más barata' }), { key: 'ArrowLeft' });
    expect(side.getByRole('radio', { name: 'La más cercana' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: 'La más cercana' }), { key: 'a' });
    expect(side.getByRole('radio', { name: 'La más cercana' })).toBeChecked();
  });

  it('tres tiendas es una recomendación más cuando es la más barata', async () => {
    const c = shop('c', 'Tienda C', 4.5539);
    stubApi({
      ...routesFor(far),
      ...comparisonOf(
        SALT,
        offer(far.a, 'sal-1kg', 1000),
        offer(far.b, 'sal-1kg', 1000),
        offer(c, 'sal-1kg', 500),
      ),
    });
    renderBasket(rice, milk, salt);

    const side = await panel();
    const cheapest = (await side.findByRole('radio', { name: 'La más barata' })).closest('label');
    expect(cheapest).toHaveTextContent('$7.500');
    expect(cheapest).toHaveTextContent('Estas tres tiendas tienen todos tus productos');
    expect(side.getAllByRole('heading', { level: 3, name: /^Tienda / })).toHaveLength(3);
  });

  it('un producto sin precio vigente se avisa y no cuenta', async () => {
    stubApi({ ...routesFor(far), ...comparisonOf(SALT) });
    renderBasket(rice, milk, salt);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(side.getByText(/Sin precio vigente cerca: Sal/)).toHaveAttribute('role', 'status');
  });

  it('con un radio que deja fuera la mejor tienda, la ofrece como «La más barata en Armenia»', async () => {
    locateAt(4.53, -75.6811);
    localStorage.setItem('valora:radio', '0.5');
    stubApi({
      ...comparisonOf(RICE, offer(near.a, 'arroz-500g', 2500), offer(near.b, 'arroz-500g', 1000)),
      ...comparisonOf(MILK, offer(near.a, 'leche-1l', 3500), offer(near.b, 'leche-1l', 3000)),
    });
    renderBasket(rice, milk);

    const side = await panel();
    const wide = (await side.findByRole('radio', { name: 'La más barata en Armenia' })).closest(
      'label',
    );
    expect(wide).toHaveTextContent(
      /Ahorras \$3\.500 frente a lo más barato cerca de ti, pero queda \d,\d km más lejos/,
    );
    expect(side.getByRole('radio', { name: 'La más barata y la más cercana' })).toBeInTheDocument();
  });

  it('si no hay tiendas con la lista dentro del radio, lo dice y muestra las del municipio', async () => {
    locateAt(4.6, -75.6811);
    localStorage.setItem('valora:radio', '0.5');
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(
      side.getByText('No hay tiendas con tu lista a 0,5 km; te mostramos las del municipio.'),
    ).toHaveAttribute('role', 'status');
  });

  it('si cerca no hay tienda con todo: una opción parcial no se llama «la más barata», hay un solo aviso y sin tarjeta naranja', async () => {
    locateAt(4.53, -75.6811);
    localStorage.setItem('valora:radio', '0.5');
    stubApi({
      ...comparisonOf(RICE, offer(near.a, 'arroz-500g', 2000), offer(near.b, 'arroz-500g', 2500)),
      ...comparisonOf(MILK, offer(near.b, 'leche-1l', 3000)),
    });
    renderBasket(rice, milk);

    const side = await panel();
    const partial = (await side.findByRole('radio', { name: 'La que más cubre' })).closest('label');
    expect(partial).toHaveTextContent('Cubre 1 de 2 productos');
    expect(side.getByRole('radio', { name: 'La más barata en Armenia' })).toBeInTheDocument();
    // Una sola explicación, coherente con lo que se ve.
    expect(side.getAllByText(/ninguna tienda .*tiene (toda|todos)/i)).toHaveLength(1);
    expect(
      side.getByText(
        'Cerca de ti, ninguna tienda sola tiene toda tu lista; con 2 tiendas del municipio sí la cubres.',
      ),
    ).toHaveAttribute('role', 'status');
    expect(side.queryByText(/Dónde te sale más barata en/)).not.toBeInTheDocument();
    expect(side.queryByText(/Ninguna tienda sola tiene todo;/)).not.toBeInTheDocument();
  });

  it('si ninguna combinación de hasta 3 tiendas cubre todo, lo dice con lo que más cubre', async () => {
    const shops = ['c', 'd', 'e', 'f'].map((id, i) =>
      shop(id, `Tienda ${id.toUpperCase()}`, 4.54 + i / 100),
    );
    stubApi({
      ...comparisonOf(RICE, offer(shops[0] as (typeof shops)[0], 'arroz-500g', 2000)),
      ...comparisonOf(MILK, offer(shops[1] as (typeof shops)[0], 'leche-1l', 3000)),
      ...comparisonOf(SALT, offer(shops[2] as (typeof shops)[0], 'sal-1kg', 1000)),
      ...comparisonOf(
        '6c4f5d97-8f41-4ebd-a094-3dae4b5f6071',
        offer(shops[3] as (typeof shops)[0], 'azucar-1kg', 1500),
      ),
    });
    renderBasket(rice, milk, salt, {
      ...salt,
      productId: '6c4f5d97-8f41-4ebd-a094-3dae4b5f6071',
      productName: 'Azúcar',
      presentationId: 'azucar-1kg',
    });

    const side = await panel();
    expect(
      await side.findByText(
        'Ninguna combinación de hasta 3 tiendas cubre toda tu lista; la que más cubre tiene 3 de 4.',
      ),
    ).toBeInTheDocument();
    expect(side.getByRole('radio', { name: 'La que más cubre' })).toBeChecked();
    expect(side.queryByRole('radio', { name: 'La más barata' })).not.toBeInTheDocument();
  });

  it('el detalle usa «a pasos de ti» también, no «a 0 m de ti»', async () => {
    locateAt(4.5336, -75.6811);
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    expect(side.queryByText(/a 0 m de ti/)).not.toBeInTheDocument();
    expect(side.getAllByText(/a pasos de ti/).length).toBeGreaterThan(1);
  });

  it('si ningún producto tiene precio, lo dice', async () => {
    stubApi({ ...comparisonOf(RICE), ...comparisonOf(MILK) });
    renderBasket(rice, milk);

    const side = await panel();
    expect(
      await side.findByText('Ningún producto de tu canasta tiene precio vigente en esta zona.'),
    ).toBeInTheDocument();
  });

  it('mientras busca los precios dice «Buscando precios…»', async () => {
    stubPendingApi();
    renderBasket(milk);

    const side = await panel();
    expect(side.getByRole('status')).toHaveTextContent('Buscando precios…');
  });

  it('si los precios no cargan, avisa', async () => {
    stubApi({});
    renderBasket(milk);

    const side = await panel();
    expect(
      await side.findByText('No pudimos calcular dónde te sale más barata.'),
    ).toBeInTheDocument();
  });

  it('cambiar de tarjeta no hace ninguna solicitud nueva: una por producto, siempre la misma URL', async () => {
    const api = stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });
    pick('Todo en una tienda');
    pick('La más barata');

    expect(api.requested).toHaveLength(2);
    expect(new Set(api.requested.map((url) => url.search)).size).toBe(1);
    expect(api.requested[0]?.searchParams.get('municipality')).toBe('armenia');
  });

  it('con la canasta vacía no hay panel', () => {
    stubApi({});
    renderBasket();

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('el selector «Dónde buscar» está en el panel', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    expect(side.getByRole('button', { name: 'Dónde buscar: Armenia' })).toBeInTheDocument();
  });

  it('en computador sigue siendo un solo panel y no tiene fallas de accesibilidad (axe)', async () => {
    stubMatchMedia(true);
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByRole('radio', { name: 'La más barata' });

    expect(screen.getAllByRole('complementary')).toHaveLength(1);
    expect(await seriousViolations()).toEqual([]);
  });
});
