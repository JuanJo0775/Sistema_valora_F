import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { readStored, writeStored } from '../../shared/storage';
import { type BasketItem, BasketContext, type NewBasketItem } from './basketContext';

// #31: la canasta vive en este navegador. No necesita cuenta ni conexión y no sale del teléfono.
const KEY = 'valora:canasta';

function readBasket(): BasketItem[] {
  try {
    return JSON.parse(readStored(KEY) ?? '[]') as BasketItem[];
  } catch {
    // Un valor dañado no rompe la app: la canasta empieza vacía.
    return [];
  }
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>(readBasket);

  const save = useCallback((change: (current: BasketItem[]) => BasketItem[]) => {
    setItems((current) => {
      const next = change(current);
      writeStored(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const add = useCallback(
    (item: NewBasketItem) => {
      save((current) =>
        current.some(({ presentationId }) => presentationId === item.presentationId)
          ? current.map((saved) =>
              saved.presentationId === item.presentationId
                ? { ...saved, quantity: saved.quantity + 1 }
                : saved,
            )
          : [...current, { ...item, quantity: 1, bought: false }],
      );
    },
    [save],
  );

  const setQuantity = useCallback(
    (presentationId: string, quantity: number) => {
      save((current) =>
        quantity <= 0
          ? current.filter((saved) => saved.presentationId !== presentationId)
          : current.map((saved) =>
              saved.presentationId === presentationId ? { ...saved, quantity } : saved,
            ),
      );
    },
    [save],
  );

  // Para ir tachando en la tienda.
  const toggleBought = useCallback(
    (presentationId: string) => {
      save((current) =>
        current.map((saved) =>
          saved.presentationId === presentationId ? { ...saved, bought: !saved.bought } : saved,
        ),
      );
    },
    [save],
  );

  const removeBought = useCallback(() => {
    save((current) => current.filter(({ bought }) => !bought));
  }, [save]);

  const value = useMemo(
    () => ({ items, add, setQuantity, toggleBought, removeBought }),
    [items, add, setQuantity, toggleBought, removeBought],
  );
  return <BasketContext value={value}>{children}</BasketContext>;
}
