import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { directionsTo } from '../../shared/directions';
import { BasketProvider } from '../basket/BasketProvider';
import { planDraft } from '../../test/planFixtures';
import { planToText } from './planText';
import { SavedPlanPage } from './SavedPlanPage';
import { readPlans, savePlan, toSavedPlan, type PlanDraft, type SavedPlan } from './savedPlan';

const NOW = new Date('2026-11-18T02:30:00Z'); // 17-nov 21:30 en Colombia
const draft = (): PlanDraft => planDraft({ area: { kind: 'municipio', municipality: 'armenia' } });

const stored = (now = new Date()): SavedPlan => {
  const plan = toSavedPlan(draft(), now);
  savePlan(plan);
  return plan;
};

// La canasta: dice a dónde se llegó y el aviso que viaja con la navegación.
function Basket() {
  const { pathname, search, state } = useLocation() as {
    pathname: string;
    search: string;
    state: { notice?: string } | null;
  };
  return <p>{`canasta:${pathname}${search}:${state?.notice ?? ''}`}</p>;
}

const renderAt = (id: string) =>
  render(
    <BasketProvider>
      <MemoryRouter initialEntries={[`/canasta/plan/${id}`]}>
        <Routes>
          <Route path="/canasta/plan/:id" element={<SavedPlanPage />} />
          <Route path="/canasta" element={<Basket />} />
        </Routes>
      </MemoryRouter>
    </BasketProvider>,
  );
const basketNames = () =>
  (JSON.parse(localStorage.getItem('valora:canasta') ?? '[]') as { productName: string }[]).map(
    (i) => i.productName,
  );

// Una canasta que ya trae un producto: «Usar esta lista» tiene que preguntar.
const withPanela = () => {
  localStorage.setItem(
    'valora:canasta',
    JSON.stringify([
      {
        productId: 'x',
        productName: 'Panela',
        presentationId: 'px',
        presentationLabel: '1 kg',
        quantity: 1,
        bought: false,
      },
    ]),
  );
};

describe('plan guardado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
    localStorage.clear();
  });

  it('muestra tiendas, dirección, cómo llegar, precios con fecha y sin precio aparte', () => {
    // El reloj queda en el día del plan: con la fecha real, a los 7 días se vería «desactualizado».
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    renderAt(stored(NOW).id);

    expect(screen.getByText(/Guardada el 17 nov/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'D1 Calle 50' })).toBeInTheDocument();
    expect(screen.getByText('Cl. 50 # 14-20')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cómo llegar a D1 Calle 50' })).toHaveAttribute(
      'href',
      directionsTo({ lat: 4.53, lng: -75.68 }),
    );
    expect(screen.getByRole('link', { name: 'Cómo llegar a Tienda Don Pepe' })).toBeInTheDocument();
    expect(screen.getByText(/Precio del 16 nov/)).toBeInTheDocument();
    expect(screen.getByText(/Traslado.*estimado/)).toBeInTheDocument();
    expect(screen.getByText(/Domicilio.*estimado/)).toBeInTheDocument();
    expect(screen.getByText('Sal marina')).toBeInTheDocument();
    expect(
      screen.getByText('Los precios cambian y vencen; actualízalo antes de salir.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Puede estar desactualizado')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('cada producto sin precio es una sola fila que se lee seguida', () => {
    renderAt(stored(NOW).id);

    const row = screen.getByText('Sal marina').closest('li');
    expect(row?.children).toHaveLength(1);
    expect(row?.textContent.replaceAll(' ', ' ').trim()).toBe('1 × Sal marina 500 g');
  });

  it('tachar Comprado cambia solo esa línea y persiste', () => {
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getAllByRole('checkbox', { name: /Comprado/ })[0] as HTMLElement);

    const after = screen.getAllByRole('checkbox', { name: /Comprado/ });
    expect(after[0]).toBeChecked();
    expect(after[1]).not.toBeChecked();
    expect(readPlans()[0]?.lines.map((l) => l.bought)).toEqual([true, false, false]);
  });

  it('sin conexión se ve igual, actualizar está deshabilitado y usar la lista sigue disponible', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderAt(stored(NOW).id);

    expect(screen.getByRole('heading', { name: 'D1 Calle 50' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar precios' })).toBeDisabled();
    expect(screen.getByText('Necesitas conexión para actualizar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usar esta lista/ })).toBeEnabled();
    expect(screen.queryByText(/Armar de nuevo/)).not.toBeInTheDocument();
  });

  it('«Usar esta lista» con la canasta vacía la carga sin preguntar y lleva a la canasta', () => {
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getByRole('button', { name: /Usar esta lista/ }));

    expect(basketNames()).toEqual(['Arroz blanco', 'Aceite', 'Sal marina']);
    expect(
      screen.getByText(/^canasta:\/canasta:Listo: cargamos «Plan del 17 nov» en tu canasta/),
    ).toBeInTheDocument();
  });

  it('«Usar esta lista» con productos en la canasta pregunta: reemplazar o agregar', () => {
    withPanela();
    const { unmount } = renderAt(stored(NOW).id);
    fireEvent.click(screen.getByRole('button', { name: /Usar esta lista/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar mi lista' }));
    expect(basketNames()).toEqual(['Arroz blanco', 'Aceite', 'Sal marina']);
    expect(screen.getByText(/Listo: cargamos/)).toBeInTheDocument();
    unmount();

    withPanela();
    renderAt(readPlans()[0]?.id ?? '');
    fireEvent.click(screen.getByRole('button', { name: /Usar esta lista/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi lista' }));
    expect(basketNames()).toEqual(['Panela', 'Arroz blanco', 'Aceite', 'Sal marina']);
    expect(screen.getByText(/Listo: agregamos/)).toBeInTheDocument();
  });

  it('con más de 7 días avisa que puede estar desactualizado', () => {
    renderAt(stored(new Date(Date.now() - 8 * 24 * 3600 * 1000)).id);
    expect(screen.getByText('Puede estar desactualizado')).toBeInTheDocument();
  });

  it('con fecha de guardado inválida también avisa que puede estar desactualizado', () => {
    const plan = stored(NOW);
    const raw = JSON.parse(localStorage.getItem('valora:planes') ?? '{}') as {
      plans: { savedAt: string }[];
    };
    (raw.plans[0] as { savedAt: string }).savedAt = 'no es fecha';
    localStorage.setItem('valora:planes', JSON.stringify(raw));
    renderAt(plan.id);
    expect(screen.getByText('Puede estar desactualizado')).toBeInTheDocument();
  });

  it.each([
    ['extra', true, undefined, /Traslado extra \(estimado\): 1,4 km más/],
    ['total', false, undefined, /^Traslado \(estimado\): 1,4 km, 19 min/],
    ['menos', true, true, /^Traslado \(estimado\): 1,4 km menos que ir a una sola tienda/],
  ])('rotula el traslado %s', (_n, extra, less, expected) => {
    const plan = stored(NOW);
    const raw = JSON.parse(localStorage.getItem('valora:planes') ?? '{}') as {
      plans: { summary: { travel: object } }[];
    };
    const first = raw.plans[0] as { summary: { travel: object } };
    first.summary.travel = { ...first.summary.travel, extra, ...(less ? { less } : {}) };
    localStorage.setItem('valora:planes', JSON.stringify(raw));
    renderAt(plan.id);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('un id desconocido muestra el estado vacío con enlace a la canasta', () => {
    renderAt('no-existe');
    expect(
      screen.getByRole('heading', { name: 'No encontramos esta lista', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /canasta/i })).toHaveAttribute('href', '/canasta');
  });

  it('Compartir usa navigator.share si existe', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(share).toHaveBeenCalledWith({
      title: 'Plan de compra de Valora',
      text: planToText(readPlans()[0] as SavedPlan),
    });
  });

  it('sin navigator.share copia y ofrece el enlace de WhatsApp', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    const text = planToText(readPlans()[0] as SavedPlan);
    const link = await screen.findByRole('link', { name: 'Abrir en WhatsApp' });
    expect(writeText).toHaveBeenCalledWith(text);
    expect(link).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(text)}`);
  });

  it('Descargar crea un archivo plan-valora-AAAA-MM-DD.txt con la fecha de Colombia', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T02:30:00Z'));
    const create = vi.fn().mockReturnValue('blob:plan');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(names).toEqual(['plan-valora-2026-11-17.txt']);
    const blob = create.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('text/plain');
    expect(revoke).toHaveBeenCalledWith('blob:plan');
  });

  it('Imprimir llama window.print', () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderAt(stored(NOW).id);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('Borrar esta lista la quita y vuelve a «Guardadas»', () => {
    renderAt(stored(NOW).id);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar esta lista' }));
    expect(readPlans()).toEqual([]);
    expect(screen.getByText(/^canasta:\/canasta\?tab=guardadas:/)).toBeInTheDocument();
  });

  it('un solo h1 y los textos hablan de «lista»', () => {
    renderAt(stored(NOW).id);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Lista guardada' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Recalcular/ })).not.toBeInTheDocument();
  });

  it('no tiene fallas graves de accesibilidad', async () => {
    renderAt(stored(NOW).id);
    expect(await seriousViolations()).toEqual([]);
  });
});
