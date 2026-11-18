import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { directionsTo } from '../../shared/directions';
import { planToText } from './planText';
import { SavedPlanPage } from './SavedPlanPage';
import { readPlans, savePlan, toSavedPlan, type PlanDraft, type SavedPlan } from './savedPlan';

const NOW = new Date('2026-11-18T02:30:00Z'); // 17-nov 21:30 en Colombia
const draft = (): PlanDraft => ({
  area: { kind: 'municipio', municipality: 'armenia' },
  stores: [
    {
      id: 's1',
      name: 'D1 Calle 50',
      type: 'descuento',
      address: 'Cl. 50 # 14-20',
      lat: 4.53,
      lng: -75.68,
      municipality: 'armenia',
      delivery: { feeCop: 5000 },
    },
    {
      id: 's2',
      name: 'Tienda Don Pepe',
      type: 'barrio',
      lat: 4.54,
      lng: -75.69,
      municipality: 'armenia',
      delivery: null,
    },
  ],
  lines: [
    {
      productId: 'p1',
      productName: 'Arroz blanco',
      presentationId: 'pr1',
      presentationLabel: '500 g',
      quantity: 2,
      storeId: 's1',
      priceCop: 2190,
      source: 'siembra',
      freshness: 'vigente',
      observedAt: '2026-11-16T15:00:00Z',
    },
    {
      productId: 'p2',
      productName: 'Aceite',
      presentationId: 'pr2',
      presentationLabel: '1 L',
      quantity: 1,
      storeId: 's2',
      priceCop: 9000,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: '2026-11-15T15:00:00Z',
    },
    {
      productId: 'p3',
      productName: 'Sal marina',
      presentationId: 'pr3',
      presentationLabel: '500 g',
      quantity: 1,
      storeId: null,
      priceCop: null,
      source: 'comunidad',
      freshness: 'vigente',
      observedAt: null,
    },
  ],
  summary: {
    stores: 2,
    productsCop: 13380,
    baselineCop: 15000,
    travel: {
      extraKm: 1.4,
      minutes: 19,
      costCop: null,
      assumptions: { detour: 1.3, kmh: 4.5, mode: 'none' },
    },
    deliveryCop: 5000,
    netCop: -3380,
    missing: 1,
  },
});

const stored = (now = new Date()): SavedPlan => {
  const plan = toSavedPlan(draft(), now);
  savePlan(plan);
  return plan;
};

const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/canasta/plan/${id}`]}>
      <Routes>
        <Route path="/canasta/plan/:id" element={<SavedPlanPage />} />
        <Route path="/canasta/plan" element={<p>pantalla del plan</p>} />
      </Routes>
    </MemoryRouter>,
  );

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
    renderAt(stored(NOW).id);

    expect(screen.getByText(/Plan guardado el 17 nov/)).toBeInTheDocument();
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
  });

  it('tachar Comprado cambia solo esa línea y persiste', () => {
    renderAt(stored(NOW).id);

    fireEvent.click(screen.getAllByRole('checkbox', { name: /Comprado/ })[0] as HTMLElement);

    const after = screen.getAllByRole('checkbox', { name: /Comprado/ });
    expect(after[0]).toBeChecked();
    expect(after[1]).not.toBeChecked();
    expect(readPlans()[0]?.lines.map((l) => l.bought)).toEqual([true, false, false]);
  });

  it('sin conexión se ve igual y armar de nuevo está deshabilitado', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderAt(stored(NOW).id);

    expect(screen.getByRole('heading', { name: 'D1 Calle 50' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Armar de nuevo/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Armar de nuevo con precios de hoy/ }),
    ).toBeDisabled();
    expect(screen.getByText('Necesitas conexión para actualizar')).toBeInTheDocument();
  });

  it('con conexión armar de nuevo enlaza al plan', () => {
    renderAt(stored(NOW).id);
    expect(screen.getByRole('link', { name: 'Armar de nuevo con precios de hoy' })).toHaveAttribute(
      'href',
      '/canasta/plan',
    );
  });

  it('con más de 7 días avisa que puede estar desactualizado', () => {
    renderAt(stored(new Date(Date.now() - 8 * 24 * 3600 * 1000)).id);
    expect(screen.getByText('Puede estar desactualizado')).toBeInTheDocument();
  });

  it('un id desconocido muestra el estado vacío con enlace a la canasta', () => {
    renderAt('no-existe');
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

  it('Borrar este plan lo quita y vuelve al plan', () => {
    renderAt(stored(NOW).id);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar este plan' }));
    expect(readPlans()).toEqual([]);
    expect(screen.getByText('pantalla del plan')).toBeInTheDocument();
  });

  it('no tiene fallas graves de accesibilidad', async () => {
    renderAt(stored(NOW).id);
    expect(await seriousViolations()).toEqual([]);
  });
});
