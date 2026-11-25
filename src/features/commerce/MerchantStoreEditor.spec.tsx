import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  // H21, H4: el resultado sale justo bajo el botón «Guardar cambios», y es el único status.
  const save = screen.getByRole('button', { name: 'Guardar cambios' });
  const status = screen.getByRole('status');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(save.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

it('valida y publica el horario semanal de la tienda', async () => {
  const { calls } = stubApi({
    'GET /v1/auth/session': { status: 200, body: { csrfToken: 'csrf' } },
    'GET /v1/establishments/s1/prices': {
      status: 200,
      body: { establishment: { id: 's1', name: 'La Rosa', lat: 4.53, lng: -75.68 }, prices: [] },
    },
    'PATCH /v1/commerce/establishment': [
      { status: 503 },
      { status: 200, body: { applied: ['openingHours'], inReview: [] } },
    ],
  });
  render(
    <MemoryRouter>
      <MerchantStoreEditor storeId="s1" onChanged={() => undefined} />
    </MemoryRouter>,
  );
  const phone = await screen.findByLabelText('Teléfono');
  const save = screen.getByRole('button', { name: 'Guardar cambios' });
  fireEvent.click(save);
  expect(screen.getByRole('alert')).toHaveTextContent('Cambia algún dato');
  fireEvent.change(phone, { target: { value: '123' } });
  fireEvent.click(save);
  expect(screen.getByRole('alert')).toHaveTextContent('Escribe un celular');
  fireEvent.change(phone, { target: { value: '' } });

  fireEvent.click(screen.getByRole('button', { name: 'Editar horario' }));
  fireEvent.click(screen.getByLabelText('Abre el lunes'));
  const opening = screen.getByLabelText('Apertura del lunes');
  const closing = screen.getByLabelText('Cierre del lunes');
  fireEvent.change(opening, { target: { value: '09:00' } });
  fireEvent.change(closing, { target: { value: '07:00' } });
  fireEvent.click(save);
  expect(screen.getByRole('alert')).toHaveTextContent('La hora de cierre');
  expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(0);

  fireEvent.change(closing, { target: { value: '17:00' } });
  fireEvent.click(save);
  await screen.findByRole('alert');
  fireEvent.click(save);
  expect(await screen.findByText(/Cambios aplicados: horario/)).toBeInTheDocument();
  expect(JSON.parse(calls.find(({ method }) => method === 'PATCH')?.body ?? '{}')).toEqual({
    openingHours: {
      lunes: { opens: '09:00', closes: '17:00' },
      martes: null,
      miercoles: null,
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
    },
  });
});

it('reintenta la carga de los datos de la tienda', async () => {
  stubApi({
    'GET /v1/establishments/s1/prices': [
      { status: 503 },
      {
        status: 200,
        body: { establishment: { id: 's1', name: 'La Rosa', lat: 4.53, lng: -75.68 }, prices: [] },
      },
    ],
  });
  render(
    <MemoryRouter>
      <MerchantStoreEditor storeId="s1" onChanged={() => undefined} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /reintentar/i }));
  expect(await screen.findByLabelText('Nombre de la tienda')).toHaveValue('La Rosa');
});

describe('editor de horario', () => {
  const open = async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { csrfToken: 'csrf' } },
      'GET /v1/establishments/s1/prices': {
        status: 200,
        body: { establishment: { id: 's1', name: 'La Rosa', lat: 4.53, lng: -75.68 }, prices: [] },
      },
    });
    const view = render(
      <MemoryRouter>
        <MerchantStoreEditor storeId="s1" onChanged={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Editar horario' }));
    return view;
  };

  it('es un grupo con leyenda y una fila con nombre por cada día, sin fieldset anidados', async () => {
    const { container } = await open();
    expect(screen.getByRole('group', { name: 'Horario semanal' })).toBeInTheDocument();
    expect(container.querySelectorAll('fieldset fieldset')).toHaveLength(0);
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByRole('group', { name: day })).toBeInTheDocument();
    }
  });

  it('cada día cerrado dice «Cerrado» y al abrirlo muestra sus dos horas con nombre claro', async () => {
    await open();
    const monday = screen.getByRole('group', { name: 'Lunes' });
    expect(within(monday).getByText('Cerrado')).toBeInTheDocument();
    expect(within(monday).queryByLabelText('Apertura del lunes')).not.toBeInTheDocument();
    fireEvent.click(within(monday).getByLabelText('Abre el lunes'));
    expect(within(monday).getByLabelText('Apertura del lunes')).toHaveValue('08:00');
    expect(within(monday).getByLabelText('Cierre del lunes')).toHaveValue('18:00');
    expect(within(monday).queryByText('Cerrado')).not.toBeInTheDocument();
  });

  it('«Copiar el horario del lunes a los demás días» solo se puede usar con el lunes abierto', async () => {
    await open();
    const copy = screen.getByRole('button', {
      name: 'Copiar el horario del lunes a los demás días',
    });
    expect(copy).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Abre el lunes'));
    expect(copy).toBeEnabled();
  });

  it('copia el horario del lunes a los demás días, los abre y lo anuncia', async () => {
    await open();
    fireEvent.click(screen.getByLabelText('Abre el lunes'));
    fireEvent.change(screen.getByLabelText('Apertura del lunes'), { target: { value: '07:30' } });
    fireEvent.change(screen.getByLabelText('Cierre del lunes'), { target: { value: '20:00' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar el horario del lunes a los demás días' }),
    );
    for (const day of ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) {
      const label = day === 'miercoles' ? 'miércoles' : day === 'sabado' ? 'sábado' : day;
      expect(screen.getByLabelText('Abre el ' + label)).toBeChecked();
      expect(screen.getByLabelText('Apertura del ' + label)).toHaveValue('07:30');
      expect(screen.getByLabelText('Cierre del ' + label)).toHaveValue('20:00');
    }
    expect(screen.getByRole('status')).toHaveTextContent('Horario del lunes copiado');
  });

  it('copiar el horario y guardar nunca dejan dos avisos a la vez (H27)', async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { csrfToken: 'csrf' } },
      'GET /v1/establishments/s1/prices': {
        status: 200,
        body: { establishment: { id: 's1', name: 'La Rosa', lat: 4.53, lng: -75.68 }, prices: [] },
      },
      'PATCH /v1/commerce/establishment': {
        status: 200,
        body: { applied: ['openingHours'], inReview: [] },
      },
    });
    render(
      <MemoryRouter>
        <MerchantStoreEditor storeId="s1" onChanged={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Editar horario' }));
    fireEvent.click(screen.getByLabelText('Abre el lunes'));
    const copy = screen.getByRole('button', {
      name: 'Copiar el horario del lunes a los demás días',
    });
    fireEvent.click(copy);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/Cambios aplicados/)).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    fireEvent.click(copy);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Horario del lunes copiado');
  });
});
