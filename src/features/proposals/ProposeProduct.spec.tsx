import { fireEvent, render, screen } from '@testing-library/react';
import { choose } from '../../test/choose';
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
  await choose('Categoría', 'Granos y abarrotes');
  fireEvent.change(screen.getByLabelText('Marca (opcional)'), { target: { value: 'Diana' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '500' } });
  await choose('Unidad', 'gramos (g)');
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

  it.each([
    ['la categoría', 'category', 'Elige la categoría.'],
    ['la cantidad', 'quantity', 'Escribe la cantidad, por ejemplo 500.'],
  ])('sin %s lo dice y no envía', async (_field, missing, message) => {
    const api = renderPropose();
    await fill();
    if (missing === 'category') {
      await choose('Categoría', 'Elige la categoría');
    } else {
      fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '' } });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('si el código de barras ya es de otro producto, lo dice', async () => {
    renderPropose({
      status: 409,
      body: { code: 'BARCODE_TAKEN', message: 'El código ya es de «Arroz blanco Diana 500 g».' },
    });
    await fill();
    fireEvent.change(screen.getByLabelText('Código de barras (opcional)'), {
      target: { value: '7702511000014' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El código ya es de «Arroz blanco Diana 500 g».',
    );
  });
});

describe('proponer un producto: mensajes y salidas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con 0 unidades o un código corto lo dice junto al campo, con su etiqueta, sin enviar', async () => {
    const api = renderPropose();
    await fill();
    fireEvent.change(screen.getByLabelText('Unidades en el empaque'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Código de barras (opcional)'), {
      target: { value: '123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(screen.getByLabelText('Unidades en el empaque')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Unidades en el empaque')).toHaveAccessibleDescription(
      /un número entero desde 1/,
    );
    expect(screen.getByLabelText('Código de barras (opcional)')).toHaveAccessibleDescription(
      /de 8 a 14 dígitos/,
    );
    expect(screen.getByLabelText('Unidades en el empaque')).toHaveFocus();
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('un error del servidor con nombres internos sale con la etiqueta del campo', async () => {
    renderPropose({
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'packCount: debe ser un entero mayor o igual a 1',
      },
    });
    await fill();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unidades en el empaque: debe ser un entero mayor o igual a 1');
    expect(alert).not.toHaveTextContent('packCount');
  });

  it('«Recibido» ofrece ver mis aportes y volver al inicio', async () => {
    renderPropose();
    await fill();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
