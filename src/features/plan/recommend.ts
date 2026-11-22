import type { Point } from '../../shared/location';
import { type BasketLine, totalsByStore } from '../basket/totals';
import { withDistance, withinRadius } from './nearby';
import { bestSplits, type SplitOption } from './split';
import { DEFAULT_ASSUMPTIONS, routeEstimate } from './travel';

// Recomendaciones del plan de compra: función pura. Recibe las ofertas del municipio (una sola
// consulta, igual para todos) y, si la persona compartió su ubicación, calcula aquí la cercanía.
// EC-06: solo cuentan precio, distancia e identificadores; nada comercial.
export type Kind = 'cheapest' | 'cheapestAll' | 'single' | 'nearest';
export type Note = 'maybeNotCheapest' | 'incomplete';
export type Notice =
  | { type: 'shareLocation' }
  | { type: 'noneInRadius'; radiusKm: number }
  | { type: 'noneComplete'; covered: number; total: number };

export interface Recommendation {
  // Identifica la combinación de tiendas y su reparto (sirve de clave).
  id: string;
  // Una o varias etiquetas: si dos recomendaciones son lo mismo, se fusionan.
  kinds: Kind[];
  option: SplitOption;
  productsCop: number;
  covered: number;
  total: number;
  // Con qué se compara `extraCop`/`extraKm`: la más barata del área, o la mejor tienda única (solo
  // para la más barata cuando reparte). Positivo = cuesta o queda más lejos; negativo = menos.
  against: 'cheapest' | 'single' | null;
  extraCop: number | null;
  extraKm: number | null;
  extraMin: number | null;
  // Recorrido total (con ubicación: ida y vuelta desde la persona) y distancia entre las tiendas.
  travelKm: number;
  betweenKm: number;
  betweenMin: number;
  notes: Note[];
}

export interface Recommendations {
  items: Recommendation[];
  notices: Notice[];
  // presentationId sin oferta vigente en el municipio: no cuentan.
  unpriced: string[];
}

const ORDER: Kind[] = ['cheapest', 'cheapestAll', 'single', 'nearest'];
const covered = (option: SplitOption) =>
  option.shares.reduce((sum, { lines }) => sum + lines.length, 0);

// La combinación (de 1, 2 o 3 tiendas) que cubre más productos y, a igual cobertura, cuesta menos.
// Una con más tiendas solo gana si cubre más o cuesta MENOS: nada de opciones dominadas.
function cheapestOf(options: SplitOption[]): SplitOption | undefined {
  return options.reduce<SplitOption | undefined>((best, option) => {
    if (!best) return option;
    const more = covered(option) - covered(best);
    return more > 0 || (more === 0 && option.productsCop < best.productsCop) ? option : best;
  }, undefined);
}

const idOf = (option: SplitOption) =>
  option.shares
    .map(({ store, lines }) => `${store.id}:${lines.map((l) => l.presentationId).join(',')}`)
    .sort()
    .join('|');

export function recommend(
  lines: BasketLine[],
  origin: Point | null,
  radiusKm: number,
): Recommendations {
  const located = origin ? withDistance(lines, origin) : lines;
  const everywhere = bestSplits(located, 3);
  const total = lines.length - everywhere.unpriced.length;
  const notices: Notice[] = [];
  if (!origin) notices.push({ type: 'shareLocation' });

  // El área de búsqueda: con ubicación, las tiendas dentro del radio (si no hay ninguna con algo de
  // la lista, se dice y se usan las del municipio); sin ella, todas.
  const inRadius = origin ? bestSplits(withinRadius(located, radiusKm), 3) : everywhere;
  const emptyRadius = origin !== null && inRadius.options.length === 0;
  if (emptyRadius && everywhere.options.length > 0)
    notices.push({ type: 'noneInRadius', radiusKm });
  const area = emptyRadius ? everywhere : inRadius;

  const cheapest = cheapestOf(area.options);
  if (!cheapest) return { items: [], notices: [], unpriced: everywhere.unpriced };

  const stops = (option: SplitOption) => option.shares.map(({ store }) => store);
  const measure = (option: SplitOption) => ({
    travel: routeEstimate(origin, stops(option), DEFAULT_ASSUMPTIONS),
    between: routeEstimate(null, stops(option), DEFAULT_ASSUMPTIONS),
  });
  const picked = new Map<string, { option: SplitOption; kinds: Kind[] }>();
  const add = (kind: Kind, option: SplitOption) => {
    const id = idOf(option);
    const known = picked.get(id);
    if (known) known.kinds.push(kind);
    else picked.set(id, { option, kinds: [kind] });
  };
  add('cheapest', cheapest);

  // Todo en una tienda: la mejor tienda única que cubre todo (si no es ya la más barata).
  const single = area.options.find(({ stores, savingsVsBestSingleCop }) => {
    return stores === 1 && savingsVsBestSingleCop !== null;
  });
  if (single && idOf(single) !== idOf(cheapest)) add('single', single);

  if (origin) {
    // La tienda más cercana con todo, en todo el municipio.
    const nearestStore = totalsByStore(located)
      .filter(({ complete }) => complete)
      .sort((x, y) => (x.store.distanceM ?? 0) - (y.store.distanceM ?? 0))[0]?.store;
    if (nearestStore) {
      const only = located.map((line) => ({
        ...line,
        offers: line.offers.filter(({ establishment }) => establishment.id === nearestStore.id),
      }));
      const [option] = bestSplits(only, 1).options;
      if (option) add('nearest', option);
    }
    // Lo más barato de todo el municipio, si mejora lo mejor del área.
    const wide = cheapestOf(everywhere.options);
    if (wide && !emptyRadius) {
      const better =
        covered(wide) > covered(cheapest) ||
        (covered(wide) === covered(cheapest) && wide.productsCop < cheapest.productsCop);
      if (better) add('cheapestAll', wide);
    }
  }

  const items = [...picked.values()].map(({ option, kinds }): Recommendation => {
    kinds.sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y));
    const mine = measure(option);
    const isCheapest = kinds.includes('cheapest');
    // La más barata se compara con la mejor tienda única; las demás, con la más barata.
    const candidate = isCheapest ? single : cheapest;
    // Solo se compara lo que cubre lo mismo: con más o menos productos el precio no es comparable.
    const partner =
      candidate && idOf(candidate) !== idOf(option) && covered(candidate) === covered(option)
        ? candidate
        : null;
    const partnerRoute = partner ? measure(partner).travel : null;
    const notes: Note[] = [];
    if (kinds.includes('nearest') && !isCheapest) notes.push('maybeNotCheapest');
    if (covered(option) < total) notes.push('incomplete');
    return {
      id: idOf(option),
      kinds,
      option,
      productsCop: option.productsCop,
      covered: covered(option),
      total,
      against: !partner ? null : isCheapest ? 'single' : 'cheapest',
      extraCop: partner ? option.productsCop - partner.productsCop : null,
      extraKm: partnerRoute ? mine.travel.km - partnerRoute.km : null,
      extraMin: partnerRoute ? mine.travel.minutes - partnerRoute.minutes : null,
      travelKm: mine.travel.km,
      betweenKm: mine.between.km,
      betweenMin: mine.between.minutes,
      notes,
    };
  });
  items.sort(
    (x, y) =>
      y.covered - x.covered ||
      x.productsCop - y.productsCop ||
      x.option.stores - y.option.stores ||
      (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
  if (covered(cheapest) < total) {
    notices.push({ type: 'noneComplete', covered: covered(cheapest), total });
  }
  return { items, notices, unpriced: everywhere.unpriced };
}
