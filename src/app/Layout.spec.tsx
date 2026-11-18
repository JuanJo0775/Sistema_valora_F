import { fireEvent, render, screen } from '@testing-library/react';
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

  it('el logo lleva a inicio y el enlace (no las imágenes) trae el nombre accesible', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);

    const link = screen.getByRole('link', { name: 'Valora, inicio' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveAttribute('aria-label', 'Valora, inicio');
    // Con el tema oscuro la imagen clara se oculta: el nombre no puede depender de ella.
    const images = link.querySelectorAll('img');
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('aria-hidden', 'true');
    }
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

  it('cada pantalla pone su título y, al navegar, el foco va al contenido y se anuncia', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);
    expect(document.title).toBe('Inicio · Valora');
    // La carga inicial no roba el foco.
    expect(screen.getByRole('main')).not.toHaveFocus();

    fireEvent.click(screen.getByRole('link', { name: /^Canasta/ }));

    expect(document.title).toBe('Canasta · Valora');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByTestId('route-announcer')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('route-announcer')).not.toHaveAttribute('role');
    expect(
      await screen.findByText('Canasta · Valora', { selector: '[aria-live="polite"]' }),
    ).toBeInTheDocument();
  });

  it('el foco pasa sin saltar el scroll', () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);
    const focus = vi.spyOn(screen.getByRole('main'), 'focus');

    fireEvent.click(screen.getByRole('link', { name: /^Mapa/ }));

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
