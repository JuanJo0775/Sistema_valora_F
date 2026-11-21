import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { choose } from '../../test/choose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { stubApi } from '../../test/fakeApi';
import { stubMatchMedia } from '../../test/matchMedia';
import { directionsTo } from '../../shared/directions';
import {
  comparisonOf,
  far,
  locateAt,
  milk,
  MILK,
  near,
  offer,
  renderPlan,
  rice,
  RICE,
  salt,
  SALT,
  shop,
} from '../../test/planFixtures';

// Tiendas A y B del plan: arroz×2 y leche×1. Una tienda: B = $8.000; arroz en A y leche en B = $7.000.
const routesFor = (s: typeof far) => ({
  ...comparisonOf(RICE, offer(s.a, 'arroz-500g', 2000), offer(s.b, 'arroz-500g', 2500)),
  ...comparisonOf(MILK, offer(s.a, 'leche-1l', 5000), offer(s.b, 'leche-1l', 3000)),
});

// La persona da su ubicación.
const locate = () => {
  locateAt(4.53, -75.6811);
};

const option = async (name: string) => within(await screen.findByRole('region', { name }));

describe('plan de compra', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('muestra las opciones de 1 y 2 tiendas con el ahorro frente a la mejor tienda única', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);

    const one = await option('1 tienda');
    expect(one.getByText('$8.000')).toBeInTheDocument();
    const two = await option('2 tiendas');
    expect(two.getByText('$7.000')).toBeInTheDocument();
    expect(two.getByText('Ahorras $1.000 frente a comprar todo en Tienda B')).toBeInTheDocument();
    expect(two.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(two.getByText('Arroz blanco')).toBeInTheDocument();
  });

  it('dice el criterio con el que ordena', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);

    expect(
      await screen.findByText(
        'Ordenamos por productos que faltan, total, suma de las distancias a las tiendas (si compartes tu ubicación) y, al final, identificadores',
      ),
    ).toBeInTheDocument();
  });

  it('cada tienda trae su dirección y un enlace Cómo llegar a <tienda>', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    expect(two.getByText('Calle Tienda B 1')).toBeInTheDocument();
    expect(two.getByRole('link', { name: 'Cómo llegar a Tienda B' })).toHaveAttribute(
      'href',
      directionsTo(far.b),
    );
  });

  it('la opción de 3 tiendas va en un bloque colapsable', async () => {
    // La sal solo es la más barata en una tercera tienda: hay reparto en 3.
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
    renderPlan(rice, milk, salt);

    await option('2 tiendas');
    const details = screen.getByText('Probar con 3 tiendas').closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(
      within(details as HTMLElement).getByRole('heading', { name: '3 tiendas', hidden: true }),
    ).toBeInTheDocument();
  });

  it('sin precio vigente en el área, lo dice y no rompe', async () => {
    stubApi({ ...comparisonOf(RICE), ...comparisonOf(MILK) });
    renderPlan(rice, milk);

    expect(await screen.findByRole('heading', { name: 'Sin precio vigente cerca' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a mi canasta' })).toHaveAttribute(
      'href',
      '/canasta',
    );
  });

  it('en computador, los supuestos y los planes guardados van en el panel lateral', async () => {
    stubApi(routesFor(far));
    stubMatchMedia(true);
    renderPlan(rice, milk);

    const aside = await screen.findByRole('complementary', {
      name: 'Supuestos del traslado y planes guardados',
    });
    expect(within(aside).getByText('Supuestos del traslado')).toBeInTheDocument();
  });

  it('en tableta y celular no hay panel lateral: los supuestos van en el mismo bloque', async () => {
    stubApi(routesFor(far));
    stubMatchMedia(false);
    renderPlan(rice, milk);

    expect(await screen.findByText('Supuestos del traslado')).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Supuestos del traslado y planes guardados' }),
    ).not.toBeInTheDocument();
  });

  it('con la canasta vacía invita a buscar productos', () => {
    stubApi({});
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
  });

  it('dice qué productos no tienen precio y cuántos cubre el total', async () => {
    stubApi({ ...routesFor(far), ...comparisonOf(SALT) });
    renderPlan(rice, milk, salt);

    const two = await option('2 tiendas');
    expect(two.getByText('Total de 2 de 3 productos')).toBeInTheDocument();
    expect(screen.getByText(/Sin precio vigente cerca: Sal/)).toBeInTheDocument();
  });

  it('sin ubicación no habla de trayecto desde tu casa; solo de distancia entre tiendas', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    expect(
      two.getByText('Sin tu ubicación no estimamos el trayecto desde tu casa'),
    ).toBeInTheDocument();
    expect(two.getByText(/Distancia entre tiendas/)).toBeInTheDocument();
    expect(two.queryByText(/Traslado extra/)).not.toBeInTheDocument();
  });

  it('con costo por km escrito muestra pesos; sin escribirlo muestra solo km y minutos', async () => {
    locate();
    stubApi(routesFor(near));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    const travel = () => two.getByText(/Traslado extra/);
    await waitFor(() => {
      expect(travel()).toHaveTextContent(/km/);
    });
    expect(travel()).toHaveTextContent(/min a pie/);
    expect(travel()).not.toHaveTextContent('$');

    await choose('Cómo cuentas el traslado', 'Costo por km');
    fireEvent.change(screen.getByLabelText('Costo por km (COP)'), { target: { value: '800' } });

    expect(travel()).toHaveTextContent('$');
  });

  it('siempre dice «estimado» y deja ver sus supuestos', async () => {
    locate();
    stubApi(routesFor(near));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    await waitFor(() => {
      expect(two.getByText(/Traslado extra estimado/)).toBeInTheDocument();
    });
    expect(two.getByText(/Supuestos: línea recta × 1,3; 4,5 km\/h/)).toBeInTheDocument();
    expect(two.getByText(/Neto estimado/)).toBeInTheDocument();
  });

  it('el interruptor «Me lo llevan a casa» con tarifa 5000 resta del neto y muestra el texto fijo', async () => {
    locate();
    stubApi(routesFor(near));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    await waitFor(() => {
      expect(two.getByText('Neto estimado: ahorras $1.000')).toBeInTheDocument();
    });
    const [first] = two.getAllByRole('group');
    fireEvent.click(within(first as HTMLElement).getByLabelText('Me lo llevan a casa'));
    fireEvent.change(within(first as HTMLElement).getByLabelText('¿Cuánto cobra el domicilio?'), {
      target: { value: '5000' },
    });

    expect(
      two.getByText(
        'Valora no hace pedidos ni domicilios. La tarifa es la que tú escribiste; confírmala con la tienda.',
      ),
    ).toBeInTheDocument();
    expect(two.getByText(/Domicilio estimado: \$5\.000/)).toBeInTheDocument();
    expect(two.queryByText('Neto estimado: ahorras $1.000')).not.toBeInTheDocument();
    expect(two.getByText('Con estos supuestos, dividir no te conviene')).toBeInTheDocument();
  });

  it('sin tarifa dice «sin estimado» y no la suma', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    const [first] = two.getAllByRole('group');
    fireEvent.click(within(first as HTMLElement).getByLabelText('Me lo llevan a casa'));

    expect(
      two.getByText('Domicilio: sin estimado (escribe la tarifa si la conoces)'),
    ).toBeInTheDocument();
    expect(two.getByText(/Neto estimado: ahorras \$1\.000/)).toBeInTheDocument();
  });

  it('si dividir no conviene, lo dice', async () => {
    locate();
    stubApi(routesFor(near));
    renderPlan(rice, milk);

    const two = await option('2 tiendas');
    await waitFor(() => {
      expect(two.getByText(/Traslado extra estimado/)).toBeInTheDocument();
    });
    await choose('Cómo cuentas el traslado', 'Pasaje');
    fireEvent.change(screen.getByLabelText('Pasaje por tramo (COP)'), {
      target: { value: '2500' },
    });

    expect(two.getByText('Con estos supuestos, dividir no te conviene')).toBeInTheDocument();
  });

  it('no escribe nada en localStorage salvo los supuestos', async () => {
    stubApi(routesFor(far));
    renderPlan(rice, milk);
    await option('2 tiendas');
    const before = Object.keys(localStorage).sort();

    fireEvent.change(screen.getByLabelText('Factor de rodeo'), { target: { value: '1.5' } });

    expect(Object.keys(localStorage).sort()).toEqual([...before, 'valora:plan-supuestos'].sort());
  });

  it('no tiene fallas de accesibilidad (axe)', async () => {
    locate();
    stubApi(routesFor(near));
    renderPlan(rice, milk);
    await option('2 tiendas');

    expect(await seriousViolations()).toEqual([]);
  });
});
