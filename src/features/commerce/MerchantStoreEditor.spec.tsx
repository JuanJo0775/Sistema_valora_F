import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { MerchantStoreEditor } from './MerchantStoreEditor';

vi.mock('../stores/StoreMap', () => ({
  StoreMap: ({ onPick }: { onPick: (point: { lat: number; lng: number }) => void }) => (
    <button
      type="button"
      onClick={() => {
        onPick({ lat: 4.54, lng: -75.68 });
      }}
    >
      Marcar ubicación
    </button>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('envía solo los datos modificados y distingue lo aplicado de lo pendiente', async () => {
  const { calls } = stubApi({
    'GET /v1/auth/session': { status: 200, body: { csrfToken: 'csrf' } },
    'GET /v1/establishments/s1/prices': {
      status: 200,
      body: { establishment: { id: 's1', name: 'La Rosa', lat: 4.53, lng: -75.68 }, prices: [] },
    },
    'PATCH /v1/commerce/establishment': {
      status: 200,
      body: { applied: ['phone'], inReview: ['name', 'location'] },
    },
  });
  render(
    <MemoryRouter>
      <MerchantStoreEditor storeId="s1" onChanged={() => undefined} />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText('Nombre de la tienda'), {
    target: { value: 'La Rosa Centro' },
  });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3001234567' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar ubicación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Marcar ubicación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText(/Cambios aplicados: teléfono/)).toBeInTheDocument();
  expect(screen.getByText(/En revisión: nombre y ubicación/)).toBeInTheDocument();
  await waitFor(() => {
    expect(calls.find(({ method }) => method === 'PATCH')?.body).toBe(
      JSON.stringify({
        name: 'La Rosa Centro',
        phone: '3001234567',
        location: { lat: 4.54, lng: -75.68 },
      }),
    );
  });
});
