import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { MerchantLeaveStore } from './MerchantLeaveStore';

const session = { 'GET /v1/auth/session': { status: 200, body: { csrfToken: 'csrf' } } };

function open(canDelete: boolean, onFinished = vi.fn()) {
  render(
    <MemoryRouter>
      <MerchantLeaveStore storeName="La Rosa" canDelete={canDelete} onFinished={onFinished} />
    </MemoryRouter>,
  );
  return onFinished;
}

describe('dejar y eliminar la tienda (H36, ADR-040)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no llama al servidor hasta que se confirma, y dice qué se retira', () => {
    const { calls } = stubApi({ ...session });
    open(false);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de administrar esta tienda' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/precios oficiales/);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/promociones/);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/seguirá en el mapa/i);
    expect(calls.filter(({ method }) => method === 'POST')).toHaveLength(0);
  });

  it('cancelar devuelve el foco al botón que abrió la confirmación', () => {
    stubApi({ ...session });
    open(false);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de administrar esta tienda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dejar de administrar esta tienda' })).toHaveFocus();
  });

  it('al confirmar deja la tienda, lo anuncia y ofrece volver a «Yo»', async () => {
    const { calls } = stubApi({
      ...session,
      'POST /v1/commerce/me/leave': { status: 200, body: { status: 'dejada' } },
    });
    const finished = open(false);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de administrar esta tienda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, dejar la tienda' }));
    const title = await screen.findByRole('heading', { name: 'Dejaste de administrar La Rosa' });
    // El foco se pone en un efecto, un instante después de que el título aparece.
    await waitFor(() => {
      expect(title).toHaveFocus();
    });
    expect(calls.find(({ method }) => method === 'POST')?.headers.get('X-CSRF-Token')).toBe('csrf');
    fireEvent.click(screen.getByRole('link', { name: 'Ir a Yo' }));
    expect(finished).toHaveBeenCalledOnce();
  });

  it('solo ofrece eliminar la tienda a quien la creó', () => {
    stubApi({ ...session });
    open(false);
    expect(screen.queryByRole('button', { name: 'Eliminar mi tienda' })).not.toBeInTheDocument();
  });

  it('elimina la tienda propia tras confirmar y avisa que sale del mapa', async () => {
    const { calls } = stubApi({
      ...session,
      'DELETE /v1/commerce/establishment': { status: 204 },
    });
    open(true);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi tienda' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/deja de salir en el mapa/i);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar la tienda' }));
    expect(await screen.findByRole('heading', { name: 'Eliminaste La Rosa' })).toBeInTheDocument();
    expect(calls.filter(({ method }) => method === 'DELETE')).toHaveLength(1);
  });

  it('si el servidor falla, la tienda sigue y se puede reintentar', async () => {
    stubApi({
      ...session,
      'POST /v1/commerce/me/leave': { status: 503 },
    });
    open(false);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de administrar esta tienda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, dejar la tienda' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, dejar la tienda' })).toBeEnabled();
  });
});
