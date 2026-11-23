import { describe, expect, it } from 'vitest';
import { planDraft } from '../../test/planFixtures';
import { hasPrices, listSummary, toBasketItems } from './savedListView';
import { toSavedPlan } from './savedPlan';

const plan = toSavedPlan(planDraft(), new Date('2026-11-17T15:00:00Z'));

describe('savedListView', () => {
  it('resume productos, tiendas y total; una tienda va en singular', () => {
    expect(listSummary(plan)).toMatch(/^3 productos · 2 tiendas · \$\s?13\.380 en productos$/);
    const one = { ...plan, lines: plan.lines.slice(0, 1), summary: { ...plan.summary, stores: 1 } };
    expect(listSummary(one)).toMatch(/^1 producto · 1 tienda · /);
  });

  it('sin tiendas o sin precios dice «Sin precios guardados»', () => {
    expect(hasPrices(plan)).toBe(true);
    expect(listSummary({ ...plan, stores: [] })).toBe('3 productos · Sin precios guardados');
    const none = { ...plan, lines: plan.lines.map((l) => ({ ...l, priceCop: null })) };
    expect(hasPrices(none)).toBe(false);
  });

  it('las líneas pasan a la canasta como pendientes', () => {
    const items = toBasketItems({
      ...plan,
      lines: plan.lines.map((l) => ({ ...l, bought: true })),
    });
    expect(items).toHaveLength(3);
    expect(items.every((i) => !i.bought)).toBe(true);
    expect(items[0]).toMatchObject({ productName: 'Arroz blanco', quantity: 2 });
  });
});
