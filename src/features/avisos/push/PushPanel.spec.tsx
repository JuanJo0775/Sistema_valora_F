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

// iOS solo permite avisos a una app instalada: sin esta guía el botón no funcionaría y la persona no
// sabría por qué.
describe('pantalla de avisos push: guía para iPhone (RN7)', () => {
  it('en Safari sin instalar explica por qué y da los pasos para instalar la app', () => {
    render(<PushPanel {...props} status="ios_sin_instalar" platform="ios-safari" />);

    expect(screen.getByText(/solo funcionan con Valora instalada/)).toBeInTheDocument();
    expect(screen.getByText('Compartir')).toBeInTheDocument();
    expect(screen.getByText('Añadir a pantalla de inicio')).toBeInTheDocument();
    expect(screen.getByText(/abre Valora desde su ícono/i)).toBeInTheDocument();
    // Con la app sin instalar el botón no serviría: no se ofrece.
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });

  it('en otro navegador del iPhone pide abrir la página en Safari', () => {
    render(<PushPanel {...props} status="ios_otro_navegador" platform="ios-other" />);

    expect(screen.getByText(/Ábrela en Safari/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });
});

// Quien bloqueó los avisos no puede volver a pedirlos desde la página: hay que decirle dónde se
// permiten otra vez.
describe('pantalla de avisos push: permiso bloqueado y navegador sin soporte (RN7)', () => {
  it('con el permiso bloqueado en un celular Android o en un computador dice dónde permitirlo', () => {
    render(<PushPanel {...props} status="denegado" platform="android" />);

    expect(screen.getByText(/Bloqueaste los avisos/)).toBeInTheDocument();
    expect(screen.getByText(/candado/)).toBeInTheDocument();
    expect(screen.getByText('Permisos')).toBeInTheDocument();
    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });

  it('con el permiso bloqueado en iPhone manda a los Ajustes del teléfono', () => {
    render(<PushPanel {...props} status="denegado" platform="ios-safari" />);

    expect(screen.getByText(/Ajustes del iPhone/)).toBeInTheDocument();
    expect(screen.queryByText(/candado/)).not.toBeInTheDocument();
  });

  it('un navegador sin soporte lo dice y sugiere otro', () => {
    render(<PushPanel {...props} status="sin_soporte" />);

    expect(screen.getByText(/no puede mostrar avisos/)).toBeInTheDocument();
    expect(screen.getByText(/Chrome, Edge o Firefox/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar avisos' })).not.toBeInTheDocument();
  });
});
