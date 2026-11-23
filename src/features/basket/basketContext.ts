import { createContext, useContext } from 'react';
import type { components } from '../../shared/api/schema';

export interface BasketItem {
  productId: string;
  productName: string;
  // Opcionales: las canastas guardadas antes no los tienen; sin ellos se ve la ilustración genérica.
  categoryCode?: string;
  image?: components['schemas']['ProductImage'];
  presentationId: string;
  presentationLabel: string;
  quantity: number;
  bought: boolean;
}

export type NewBasketItem = Pick<
  BasketItem,
  'productId' | 'productName' | 'categoryCode' | 'image' | 'presentationId' | 'presentationLabel'
>;

// #76: el aviso de lo último que se agregó. `id` cambia con cada agregado, para reiniciar el aviso.
export interface BasketNotice {
  id: number;
  productName: string;
  detail: string | undefined;
}

export interface BasketState {
  items: BasketItem[];
  // `detail` es una línea opcional para el aviso, por ejemplo dónde sale más barato.
  add: (item: NewBasketItem, detail?: string) => void;
  notice: BasketNotice | null;
  dismiss: () => void;
  setQuantity: (presentationId: string, quantity: number) => void;
  toggleBought: (presentationId: string) => void;
  removeBought: () => void;
  // Una lista guardada que se vuelve a usar: cambia toda la canasta o suma a lo que ya hay.
  replaceAll: (items: BasketItem[]) => void;
  addMany: (items: BasketItem[]) => void;
}

export const BasketContext = createContext<BasketState>({
  items: [],
  add: () => undefined,
  notice: null,
  dismiss: () => undefined,
  setQuantity: () => undefined,
  toggleBought: () => undefined,
  removeBought: () => undefined,
  replaceAll: () => undefined,
  addMany: () => undefined,
});

export const useBasket = () => useContext(BasketContext);
