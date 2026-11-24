import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';

type OnlineOffersState =
  | { status: 'loading' }
  | { status: 'ready'; items: components['schemas']['OnlineOffer'][] }
  | { status: 'unavailable' };

export function useOnlineOffers(productId: string): OnlineOffersState {
  const [result, setResult] = useState<{ productId: string; state: OnlineOffersState } | null>(
    null,
  );

  useEffect(() => {
    const request = new AbortController();
    call(
      api.GET('/products/{productId}/online-offers', {
        params: { path: { productId }, query: { zone: 'armenia-centro' } },
        signal: request.signal,
        cache: 'no-store',
      }),
    )
      .then(({ items }) => {
        if (!request.signal.aborted) setResult({ productId, state: { status: 'ready', items } });
      })
      .catch(() => {
        if (!request.signal.aborted) setResult({ productId, state: { status: 'unavailable' } });
      });
    return () => {
      request.abort();
    };
  }, [productId]);

  return result?.productId === productId ? result.state : { status: 'loading' };
}
