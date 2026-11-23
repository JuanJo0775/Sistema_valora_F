import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { readStored, writeStored } from '../../shared/storage';
import {
  type BasketItem,
  BasketContext,
  type BasketNotice,
  type NewBasketItem,
} from './basketContext';

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
  const [notice, setNotice] = useState<BasketNotice | null>(null);

  const save = useCallback((change: (current: BasketItem[]) => BasketItem[]) => {
    setItems((current) => {
      const next = change(current);
      writeStored(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const add = useCallback(
    (item: NewBasketItem, detail?: string) => {
      setNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        productName: item.productName,
        detail,
      }));
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

  const replaceAll = useCallback(
    (next: BasketItem[]) => {
      save(() => next);
    },
    [save],
  );

  // Suma las cantidades de lo que ya está (misma presentación) y agrega lo demás al final.
  const addMany = useCallback(
    (more: BasketItem[]) => {
      save((current) => {
        const next = current.map((saved) => ({ ...saved }));
        for (const item of more) {
          const known = next.find(({ presentationId }) => presentationId === item.presentationId);
          if (known) known.quantity += item.quantity;
          else next.push({ ...item });
        }
        return next;
      });
    },
    [save],
  );

  const dismiss = useCallback(() => {
    setNotice(null);
  }, []);

  const value = useMemo(
    () => ({
      items,
      add,
      notice,
      dismiss,
      setQuantity,
      toggleBought,
      removeBought,
      replaceAll,
      addMany,
    }),
    [items, add, notice, dismiss, setQuantity, toggleBought, removeBought, replaceAll, addMany],
  );
  return <BasketContext value={value}>{children}</BasketContext>;
}
