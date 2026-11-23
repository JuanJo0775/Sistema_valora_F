import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { MILK, RICE, item, offer, planDraft, shop } from '../../test/planFixtures';
import {
  defaultListName,
  MAX_PLANS,
  readPlans,
  savePlan,
  toSavedPlan,
  type PlanDraft,
} from '../plan/savedPlan';
import { BasketPage } from './BasketPage';
import { BasketProvider } from './BasketProvider';

const rice = item(RICE, 'Arroz blanco', 'arroz-500g', 2);
const milk = item(MILK, 'Leche entera', 'leche-1l');
const ara = shop('a1', 'Ara', 4.5339);
const exito = shop('e1', 'Éxito', 4.5339);

const comparison = (productId: string, ...results: ReturnType<typeof offer>[]) => ({
  [`GET /v1/products/${productId}/comparison`]: {
    status: 200,
    body: {
      productId,
      criteria: { sort: 'unit_price', municipality: 'armenia' },
      results,
      promotions: [],
    },
  },
});
const prices = () =>
  stubApi({
    ...comparison(RICE, offer(ara, 'arroz-500g', 2600), offer(exito, 'arroz-500g', 2400)),
    ...comparison(MILK, offer(ara, 'leche-1l', 4000), offer(exito, 'leche-1l', 3900)),
  });

const renderBasket = (items: ReturnType<typeof item>[], at = '/canasta') => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter initialEntries={[at]}>
        <BasketPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

const NOW = new Date('2026-11-17T15:00:00Z');
const bare = (): PlanDraft => ({
  area: { kind: 'municipio', municipality: 'armenia' },
  stores: [],
  lines: planDraft().lines.map((l) => ({ ...l, storeId: null, priceCop: null, observedAt: null })),
  summary: {
    stores: 0,
    productsCop: 0,
    baselineCop: null,
    travel: null,
    deliveryCop: 0,
    netCop: null,
    missing: 3,
  },
});
// Tres listas: una con nombre y precios, una sin precios y una anterior (sin nombre).
const seed = () => {
  const named = toSavedPlan(planDraft(), new Date('2026-11-20T12:00:00Z'), 'Mercado semanal');
  const unpriced = toSavedPlan(bare(), new Date('2026-11-19T12:00:00Z'), 'Solo la lista');
  const old = toSavedPlan(planDraft(), NOW);
  [named, unpriced, old].forEach(savePlan);
  return { named, unpriced, old };
};
const card = (name: string) =>
  within(screen.getByRole('heading', { name }).closest('li') as HTMLElement);
const basketNames = () =>
  (JSON.parse(localStorage.getItem('valora:canasta') ?? '[]') as { productName: string }[]).map(
    (i) => i.productName,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pestañas «Mi lista | Guardadas»', () => {
  it('con la canasta vacía, «Mi lista» muestra el estado vacío y «Guardadas» sigue a mano', () => {
    stubApi({});
    renderBasket([]);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Guardadas (0)' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Mi lista');
  });

  it('las flechas, Inicio y Fin cambian de pestaña y mueven el foco', () => {
    stubApi({});
    renderBasket([]);
    const mine = screen.getByRole('tab', { name: 'Mi lista' });
    mine.focus();
    fireEvent.keyDown(mine, { key: 'ArrowRight' });
    const saved = screen.getByRole('tab', { name: /Guardadas/ });
    expect(saved).toHaveAttribute('aria-selected', 'true');
    expect(saved).toHaveFocus();
    expect(saved).toHaveAttribute('tabindex', '0');
    expect(mine).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('heading', { name: 'Aún no tienes listas guardadas' })).toBeVisible();
    fireEvent.keyDown(saved, { key: 'ArrowRight' });
    expect(mine).toHaveFocus();
    fireEvent.keyDown(mine, { key: 'End' });
    expect(saved).toHaveFocus();
    fireEvent.keyDown(saved, { key: 'Home' });
    expect(mine).toHaveFocus();
    fireEvent.keyDown(mine, { key: 'a' });
    expect(mine).toHaveFocus();
    fireEvent.click(saved);
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Mi lista' }));
    expect(mine).toHaveAttribute('aria-selected', 'true');
  });

  it('el contador cuenta las listas y «Guardadas» se ve aunque la canasta esté vacía', () => {
    stubApi({});
    seed();
    renderBasket([], '/canasta?tab=guardadas');
    expect(screen.getByRole('tab', { name: 'Guardadas (3)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('«Guardar lista» en «Dónde comprar»', () => {
  const panel = () => screen.findByRole('complementary', { name: 'Dónde comprar' });
  const open = async () => {
    prices();
    renderBasket([rice, milk]);
    const aside = await panel();
    await within(aside).findByRole('button', { name: 'Guardar lista' });
    return aside;
  };

  it('trae «Lista del <fecha>» escrito, guarda con él y enlaza a «Guardadas»', async () => {
    const aside = await open();
    const name = within(aside).getByRole('textbox', { name: 'Nombre de la lista' });
    expect(name).toHaveValue(defaultListName(new Date().toISOString()));
    fireEvent.click(within(aside).getByRole('button', { name: 'Guardar lista' }));
    expect(readPlans()[0]?.listName).toBe(defaultListName(new Date().toISOString()));
    expect(within(aside).getByText('Lista guardada')).toBeInTheDocument();
    expect(within(aside).getByRole('link', { name: 'Ver en Guardadas' })).toHaveAttribute(
      'href',
      '/canasta?tab=guardadas',
    );
    expect(screen.getByRole('tab', { name: 'Guardadas (1)' })).toBeInTheDocument();
    const json = localStorage.getItem('valora:planes') ?? '';
    expect(json).not.toContain('distanceM');
  });

  it('guarda el nombre editado, y un nombre vacío vuelve al de siempre', async () => {
    const aside = await open();
    const name = within(aside).getByRole('textbox', { name: 'Nombre de la lista' });
    fireEvent.change(name, { target: { value: 'Mercado semanal' } });
    fireEvent.click(within(aside).getByRole('button', { name: 'Guardar lista' }));
    expect(readPlans()[0]?.listName).toBe('Mercado semanal');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(within(aside).getByRole('button', { name: 'Guardar lista' }));
    expect(readPlans()[0]?.listName).toBe(defaultListName(new Date().toISOString()));
  });

  it('con el cupo lleno lo dice y no guarda', async () => {
    const aside = await open();
    for (let i = 0; i < MAX_PLANS; i++)
      savePlan({ ...toSavedPlan(bare(), NOW, `Lista ${String(i)}`) });
    fireEvent.click(within(aside).getByRole('button', { name: 'Guardar lista' }));
    expect(
      within(aside).getByText('Ya tienes 20 listas guardadas. Borra una para guardar otra.'),
    ).toBeInTheDocument();
    expect(readPlans()).toHaveLength(MAX_PLANS);
  });

  it('si el navegador no deja escribir, dice el mensaje exacto', async () => {
    const aside = await open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota', 'QuotaExceededError');
    });
    fireEvent.click(within(aside).getByRole('button', { name: 'Guardar lista' }));
    expect(
      within(aside).getByText(
        'No se pudo guardar en este navegador (modo privado o sin espacio). Puedes compartirlo o imprimirlo.',
      ),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('sin ninguna recomendación con precios ofrece «Guardar solo la lista»', async () => {
    stubApi({
      ...comparison(RICE),
      ...comparison(MILK),
    });
    renderBasket([rice, milk]);
    const aside = await panel();
    fireEvent.click(await within(aside).findByRole('button', { name: 'Guardar solo la lista' }));
    const [plan] = readPlans();
    expect(plan?.stores).toEqual([]);
    expect(plan?.lines.map((l) => l.priceCop)).toEqual([null, null]);
    expect(plan?.lines.map((l) => l.quantity)).toEqual([2, 1]);
    expect(within(aside).getByText('Lista guardada')).toBeInTheDocument();
  });
});

describe('tarjetas de «Guardadas»', () => {
  const view = (items: ReturnType<typeof item>[] = []) => {
    stubApi({});
    prices();
    return renderBasket(items, '/canasta?tab=guardadas');
  };

  it('muestra nombre, fecha y resumen; sin precios y los anteriores se entienden', () => {
    const { named, old } = seed();
    view();
    expect(
      card('Mercado semanal').getByText(/3 productos · 2 tiendas · \$13\.380 en productos/),
    ).toBeInTheDocument();
    expect(card('Mercado semanal').getByText('Guardada el 20 nov')).toBeInTheDocument();
    expect(card('Solo la lista').getByText('3 productos · Sin precios guardados')).toBeVisible();
    expect(card('Plan del 17 nov').getByText(/2 tiendas/)).toBeVisible();
    expect(card('Mercado semanal').getByRole('link', { name: /Abrir/ })).toHaveAttribute(
      'href',
      `/canasta/plan/${named.id}`,
    );
    expect(card('Plan del 17 nov').getByRole('link', { name: /Abrir/ })).toHaveAttribute(
      'href',
      `/canasta/plan/${old.id}`,
    );
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Mercado semanal', 'Solo la lista', 'Plan del 17 nov']);
  });

  it('con la canasta vacía, «Usar esta lista» la carga sin preguntar y pasa a «Mi lista»', () => {
    seed();
    view();
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Usar esta lista/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(basketNames()).toEqual(['Arroz blanco', 'Aceite', 'Sal marina']);
    expect(screen.getByRole('tab', { name: 'Mi lista' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Listo: cargamos «Mercado semanal» en tu canasta')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
    const saved = JSON.parse(localStorage.getItem('valora:canasta') ?? '[]') as {
      bought: boolean;
    }[];
    expect(saved.every((i) => !i.bought)).toBe(true);
  });

  it('con productos en la canasta pregunta, y «Reemplazar mi lista» es lo principal', () => {
    seed();
    view([rice, milk]);
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Usar esta lista/ }));
    const dialog = screen.getByRole('dialog', { name: 'Usar «Mercado semanal»' });
    expect(within(dialog).getByRole('button', { name: 'Reemplazar mi lista' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reemplazar mi lista' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(basketNames()).toEqual(['Arroz blanco', 'Aceite', 'Sal marina']);
  });

  it('«Agregar a mi lista» suma a lo que ya hay', () => {
    seed();
    view([rice, milk]);
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Usar esta lista/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi lista' }));
    expect(basketNames()).toHaveLength(5);
    expect(screen.getByText(/Listo: agregamos «Mercado semanal»/)).toBeInTheDocument();
  });

  it('Escape cierra el diálogo, deja la canasta igual y devuelve el foco al botón', () => {
    seed();
    view([rice, milk]);
    const use = card('Mercado semanal').getByRole('button', { name: /Usar esta lista/ });
    fireEvent.click(use);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(basketNames()).toEqual(['Arroz blanco', 'Leche entera']);
    expect(use).toHaveFocus();
  });

  it('renombrar en el mismo lugar: Enter guarda, Escape cancela y el foco vuelve', () => {
    seed();
    view();
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Renombrar/ }));
    const field = screen.getByRole('textbox', { name: 'Nombre de la lista' });
    expect(field).toHaveFocus();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Mercado semanal' })).toBeInTheDocument();
    expect(card('Mercado semanal').getByRole('button', { name: /Renombrar/ })).toHaveFocus();
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Renombrar/ }));
    const again = screen.getByRole('textbox', { name: 'Nombre de la lista' });
    fireEvent.change(again, { target: { value: 'Mercado del mes' } });
    fireEvent.submit(again);
    expect(screen.getByRole('heading', { name: 'Mercado del mes' })).toBeInTheDocument();
    expect(readPlans().some((p) => p.listName === 'Mercado del mes')).toBe(true);
  });

  it('duplicar agrega «(copia)»; con el cupo lleno lo dice', () => {
    seed();
    view();
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Duplicar/ }));
    expect(screen.getByRole('heading', { name: 'Mercado semanal (copia)' })).toBeInTheDocument();
    expect(screen.getByText('Lista duplicada.')).toBeInTheDocument();
    for (let i = 0; i < MAX_PLANS; i++) savePlan(toSavedPlan(bare(), NOW, `Otra ${String(i)}`));
    fireEvent.click(card('Mercado semanal').getByRole('button', { name: /Duplicar/ }));
    expect(
      screen.getByText('Ya tienes 20 listas guardadas. Borra una para guardar otra.'),
    ).toBeInTheDocument();
  });

  it('borrar pide confirmar; cancelar no borra y confirmar sí', () => {
    seed();
    view();
    const del = card('Solo la lista').getByRole('button', { name: /Borrar/ });
    fireEvent.click(del);
    expect(screen.getByText('¿Borrar «Solo la lista»? No se puede deshacer.')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(readPlans()).toHaveLength(3);
    fireEvent.click(card('Solo la lista').getByRole('button', { name: /Borrar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    expect(readPlans().map((p) => p.listName)).not.toContain('Solo la lista');
    expect(screen.getByText('Lista borrada.')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Guardadas (2)' })).toBeInTheDocument();
  });
});
