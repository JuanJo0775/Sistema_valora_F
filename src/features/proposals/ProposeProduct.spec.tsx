import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { ProposeProduct } from './ProposeProduct';

const categories: FakeReply = {
  status: 200,
  body: {
    items: [
      { code: 'grains-groceries', name: 'Granos y abarrotes' },
      { code: 'dairy-eggs', name: 'Lácteos y huevos' },
    ],
  },
};

const renderPropose = (
  reply: FakeReply = { status: 202, body: { id: crypto.randomUUID(), status: 'pendiente' } },
) => {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('reportante'),
    'GET /v1/categories': categories,
    'POST /v1/product-requests': reply,
  });
  render(
    <MemoryRouter initialEntries={['/proponer/producto?nombre=Arroz%20integral']}>
      <Routes>
        <Route path="/proponer/producto" element={<ProposeProduct />} />
      </Routes>
    </MemoryRouter>,
  );
  return api;
};

const fill = async () => {
  fireEvent.change(await screen.findByRole('combobox', { name: 'Categoría' }), {
    target: { value: 'grains-groceries' },
  });
  fireEvent.change(screen.getByLabelText('Marca (opcional)'), { target: { value: 'Diana' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '500' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Unidad' }), { target: { value: 'g' } });
};

describe('proponer un producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con el nombre que se buscó, se completan los datos y queda pendiente de un moderador', async () => {
    const api = renderPropose();
    expect(await screen.findByLabelText('Nombre del producto')).toHaveValue('Arroz integral');

    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    expect(
      screen.getByText('Aparecerá en la búsqueda cuando un moderador lo apruebe.'),
    ).toBeInTheDocument();
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      name: 'Arroz integral',
      brand: 'Diana',
      categoryCode: 'grains-groceries',
      quantity: 500,
      unit: 'g',
      packCount: 1,
    });
  });
});
