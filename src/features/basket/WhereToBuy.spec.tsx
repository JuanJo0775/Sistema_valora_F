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

// «Dónde comprar» dentro de la canasta: 1 tienda (la tarjeta de siempre), 2 y 3 tiendas (el reparto).
// Tiendas A y B: arroz×2 y leche×1. Una tienda: B = $8.000; arroz en A y leche en B = $7.000.
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
const pick = (name: string) => {
  fireEvent.click(screen.getByRole('radio', { name }));
};

describe('canasta: dónde comprar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('es un solo panel con fichas «1 tienda | 2 tiendas | 3 tiendas»; la 1 es la tarjeta de siempre', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    expect(await side.findByText('Tienda B')).toHaveClass('cheapest-store-name');
    expect(side.getByRole('heading', { name: 'Dónde comprar' })).toBeInTheDocument();
    expect(side.getByRole('heading', { name: 'Compra todo en' })).toBeInTheDocument();
    expect(side.getByText('$8.000')).toBeInTheDocument();
    expect(side.getByRole('radiogroup', { name: 'Cuántas tiendas' })).toBeInTheDocument();
    expect(side.getByRole('radio', { name: '1 tienda' })).toBeChecked();
    expect(side.getByRole('radio', { name: '2 tiendas' })).not.toBeChecked();
    expect(side.getByRole('radio', { name: '3 tiendas' })).not.toBeChecked();
    expect(screen.getAllByRole('complementary')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('en la ficha 1 ya no hay botón «Armar plan de compra»: hay un enlace al plan completo', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    expect(side.queryByRole('link', { name: 'Armar plan de compra' })).not.toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Ver el plan completo y guardarlo' })).toHaveAttribute(
      'href',
      '/canasta/plan',
    );
  });

  it('la ficha 2 muestra el reparto, el ahorro y «Cómo llegar» por tienda', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('2 tiendas');

    expect(side.getByText('$7.000')).toBeInTheDocument();
    expect(side.getByText('Ahorras $1.000 frente a comprar todo en Tienda B')).toBeInTheDocument();
    expect(side.getAllByRole('heading', { level: 3, name: /^Tienda / })).toHaveLength(2);
    expect(side.getByText('Arroz blanco')).toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Cómo llegar a Tienda A' })).toHaveAttribute(
      'href',
      directionsTo(far.a),
    );
    expect(side.getByRole('link', { name: 'Cómo llegar a Tienda B' })).toBeInTheDocument();
    expect(side.getByRole('link', { name: 'Ver el plan completo y guardarlo' })).toHaveAttribute(
      'href',
      '/canasta/plan',
    );
    expect(side.queryByRole('button', { name: /Guardar plan/ })).not.toBeInTheDocument();
  });

  it('el traslado y domicilio va plegado, es «estimado» y no trae pesos por defecto', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('2 tiendas');

    const fold = side.getByText('Traslado y domicilio (estimado)').closest('details');
    expect(fold).not.toHaveAttribute('open');
    expect(within(fold as HTMLElement).getByText('Supuestos del traslado')).toBeInTheDocument();
    expect(
      within(fold as HTMLElement).getByText(/Supuestos: línea recta × 1,3; 4,5 km\/h/),
    ).toBeInTheDocument();
    expect(fold).not.toHaveTextContent('$');
  });

  it('sin ubicación no habla de trayecto desde casa, solo de la distancia entre tiendas', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('2 tiendas');

    expect(
      side.getByText('Sin tu ubicación no estimamos el trayecto desde tu casa'),
    ).toBeInTheDocument();
    expect(side.getByText(/Distancia entre tiendas/)).toBeInTheDocument();
    expect(side.getByText('Sin tu ubicación, el neto no cuenta el traslado.')).toBeInTheDocument();
  });

  it('con ubicación, el área manda en todas las fichas y el traslado se llama estimado', async () => {
    locateAt(4.53, -75.6811);
    const api = stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    expect(api.requested.every((url) => url.searchParams.has('lat'))).toBe(true);
    pick('2 tiendas');

    expect(await side.findByText(/Traslado extra estimado/)).toBeInTheDocument();
    expect(side.getByText(/Neto estimado/)).toBeInTheDocument();
  });

  it('el interruptor de domicilio resta del neto y deja el texto fijo; el dato se conserva al cambiar de ficha', async () => {
    locateAt(4.53, -75.6811);
    stubApi(routesFor(near));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('2 tiendas');
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

    pick('1 tienda');
    pick('2 tiendas');
    expect(side.getByLabelText('¿Cuánto cobra el domicilio?')).toHaveValue(5000);
  });

  it('cambiar de ficha no pierde lo escrito en los supuestos', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('2 tiendas');
    fireEvent.change(side.getByLabelText('Factor de rodeo'), { target: { value: '1.5' } });
    pick('1 tienda');
    pick('2 tiendas');

    expect(side.getByLabelText('Factor de rodeo')).toHaveValue(1.5);
    expect(side.getByText(/línea recta × 1,5/)).toBeInTheDocument();
  });

  it('las flechas del teclado cambian de ficha', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    const one = side.getByRole('radio', { name: '1 tienda' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    expect(side.getByRole('radio', { name: '2 tiendas' })).toBeChecked();
    expect(side.getByRole('radio', { name: '2 tiendas' })).toHaveFocus();
    fireEvent.keyDown(side.getByRole('radio', { name: '2 tiendas' }), { key: 'ArrowDown' });
    expect(side.getByRole('radio', { name: '3 tiendas' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: '3 tiendas' }), { key: 'ArrowRight' });
    expect(side.getByRole('radio', { name: '1 tienda' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: '1 tienda' }), { key: 'ArrowLeft' });
    expect(side.getByRole('radio', { name: '3 tiendas' })).toBeChecked();
    fireEvent.keyDown(side.getByRole('radio', { name: '3 tiendas' }), { key: 'a' });
    expect(side.getByRole('radio', { name: '3 tiendas' })).toBeChecked();
  });

  it('la ficha 3 reparte en tres tiendas', async () => {
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
    await side.findByRole('link', { name: 'Ver el plan completo y guardarlo' });
    pick('3 tiendas');

    expect(side.getAllByRole('heading', { level: 3, name: /^Tienda / })).toHaveLength(3);
  });

  it('sin reparto en 3 tiendas, la ficha 3 lo dice', async () => {
    stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    pick('3 tiendas');

    expect(
      side.getByText('Con 3 tiendas no hay un reparto distinto de los anteriores.'),
    ).toBeInTheDocument();
  });

  it('un producto sin precio vigente se avisa en las fichas 2 y 3', async () => {
    stubApi({ ...routesFor(far), ...comparisonOf(SALT) });
    renderBasket(rice, milk, salt);

    const side = await panel();
    await side.findByText('Ninguna tienda tiene todos tus productos.');
    pick('2 tiendas');

    expect(side.getByText(/Sin precio vigente cerca: Sal/)).toHaveAttribute('role', 'status');
    expect(side.getByText('Total de 2 de 3 productos')).toBeInTheDocument();
  });

  it('si ningún producto tiene precio, la ficha 2 lo dice', async () => {
    stubApi({ ...comparisonOf(RICE), ...comparisonOf(MILK) });
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Ninguna tienda tiene todos tus productos.');
    pick('2 tiendas');

    expect(
      side.getByText('Ningún producto de tu canasta tiene precio vigente en esta zona.'),
    ).toBeInTheDocument();
  });

  it('mientras busca los precios, las fichas 2 y 3 dicen «Buscando precios…»', async () => {
    stubPendingApi();
    renderBasket(milk);

    const side = await panel();
    pick('2 tiendas');

    expect(side.getByRole('status')).toHaveTextContent('Buscando precios…');
  });

  it('si los precios no cargan, la ficha 2 avisa', async () => {
    stubApi({});
    renderBasket(milk);

    const side = await panel();
    await side.findByText('No pudimos calcular dónde te sale más barata.');
    pick('2 tiendas');

    expect(side.getByText('No pudimos calcular el reparto.')).toBeInTheDocument();
  });

  it('no repite las consultas al abrir las fichas 2 y 3', async () => {
    const api = stubApi(routesFor(far));
    renderBasket(rice, milk);

    const side = await panel();
    await side.findByText('Tienda B');
    const before = api.requested.length;
    pick('2 tiendas');
    pick('3 tiendas');

    expect(before).toBe(2);
    expect(api.requested).toHaveLength(before);
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
    await side.findByText('Tienda B');
    pick('2 tiendas');

    expect(screen.getAllByRole('complementary')).toHaveLength(1);
    expect(await seriousViolations()).toEqual([]);
  });
});
