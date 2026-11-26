import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PushPanel } from './PushPanel';

const props = {
  busy: false,
  error: null,
  platform: 'other' as const,
  onEnable: vi.fn(),
  onDisable: vi.fn(),
};

// RN7 de RF-020: la pantalla le dice a la persona el paso que le falta según su dispositivo.
describe('pantalla de avisos push: activar y desactivar (RN7)', () => {
  it('con todo listo explica qué recibirá y ofrece activar los avisos', () => {
    const onEnable = vi.fn();
    render(<PushPanel {...props} status="listo" onEnable={onEnable} />);

    expect(screen.getByRole('heading', { name: 'Avisos en este dispositivo' })).toBeInTheDocument();
    expect(screen.getByText(/incluso con la app cerrada/)).toBeInTheDocument();
    expect(screen.getByText(/te pedirá permiso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activar avisos' }));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('con los avisos activos lo dice y ofrece desactivarlos', () => {
    const onDisable = vi.fn();
    render(<PushPanel {...props} status="activo" onDisable={onDisable} />);

    expect(screen.getByText('Avisos activados en este dispositivo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar avisos' }));
    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });
});
