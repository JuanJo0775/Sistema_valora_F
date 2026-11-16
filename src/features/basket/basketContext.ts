import { createContext, useContext } from 'react';

export interface BasketItem {
  productId: string;
  productName: string;
  presentationId: string;
  presentationLabel: string;
  quantity: number;
  bought: boolean;
}

export type NewBasketItem = Pick<
  BasketItem,
  'productId' | 'productName' | 'presentationId' | 'presentationLabel'
>;

export interface BasketState {
  items: BasketItem[];
  add: (item: NewBasketItem) => void;
}

export const BasketContext = createContext<BasketState>({ items: [], add: () => undefined });

export const useBasket = () => useContext(BasketContext);
