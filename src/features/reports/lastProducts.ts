import { readStored, writeStored } from '../../shared/storage';

// Los últimos productos para los que se registró un precio, solo en este navegador: un atajo para
// volver a registrar sin buscar. Son datos públicos del catálogo (nada de quien reporta).
const KEY = 'valora:ultimos-productos';
const MAX = 3;

export interface RecentProduct {
  id: string;
  name: string;
}

export function readRecentProducts(): RecentProduct[] {
  const saved = readStored(KEY);
  try {
    const list: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (item): item is RecentProduct =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as RecentProduct).id === 'string' &&
          typeof (item as RecentProduct).name === 'string',
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveRecentProduct(product: RecentProduct) {
  const others = readRecentProducts().filter(({ id }) => id !== product.id);
  writeStored(
    KEY,
    JSON.stringify([{ id: product.id, name: product.name }, ...others].slice(0, MAX)),
  );
}
