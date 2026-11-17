import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, stubApi } from '../test/fakeApi';
import { App } from './App';

// Leaflet necesita un navegador de verdad para dibujar el mapa.
vi.mock('../features/stores/StoreMap', () => ({ StoreMap: () => null }));

describe('encabezado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('el logo lleva a inicio y solo una de sus dos imágenes es accesible', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);

    const link = screen.getByRole('link', { name: 'Valora, inicio' });
    expect(link).toHaveAttribute('href', '/');
    // La variante del otro tema lleva alt vacío: el lector de pantalla lee «Valora, inicio» una vez.
    expect(within(link).getAllByRole('img')).toHaveLength(1);
    expect(link.querySelectorAll('img')).toHaveLength(2);
    expect(link.querySelectorAll('img[alt=""]')).toHaveLength(1);
  });

  it('�Saltar al contenido� es el primer enlace y enfoca el contenido sin cambiar la direcci�n', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);

    const skip = screen.getAllByRole('link')[0];
    expect(skip).toHaveAccessibleName('Saltar al contenido');
    fireEvent.click(skip as HTMLElement);

    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('');
  });
});
