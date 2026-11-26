import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { App } from './App';

// Leaflet necesita un navegador de verdad para dibujar el mapa.
vi.mock('../features/stores/StoreMap', () => ({ StoreMap: () => null }));

describe('encabezado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('lleva al comercio a sus precios oficiales desde la navegación principal', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('comercio') });
    render(<App />);

    expect(await screen.findByRole('link', { name: 'Precios oficiales' })).toHaveAttribute(
      'href',
      '/comercios',
    );
    expect(screen.queryByRole('link', { name: 'Registrar precio' })).not.toBeInTheDocument();
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

    // La pantalla se descarga al abrirla (H-26): el título y el foco cambian cuando llega.
    await waitFor(() => {
      expect(document.title).toBe('Canasta · Valora');
    });
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByTestId('route-announcer')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('route-announcer')).not.toHaveAttribute('role');
    expect(
      await screen.findByText('Canasta · Valora', { selector: '[aria-live="polite"]' }),
    ).toBeInTheDocument();
  });

  it('el foco pasa sin saltar el scroll', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    render(<App />);
    const focus = vi.spyOn(screen.getByRole('main'), 'focus');

    fireEvent.click(screen.getByRole('link', { name: /^Mapa/ }));

    await waitFor(() => {
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });
  });

  // ADR-043: la campana de avisos vive en el encabezado de moderadores y comercios.
  it('el moderador ve en el encabezado cuántos casos esperan su decisión', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/moderation/summary': {
        status: 200,
        body: { precios: 2, tiendas: 0, productos: 1, comercios: 0 },
      },
    });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Avisos: 3 pendientes' })).toBeInTheDocument();
  });

  it('el comercio ve en el encabezado cuántos avisos tiene', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('comercio'),
      'GET /v1/commerce/alerts': {
        status: 200,
        body: {
          items: [
            {
              kind: 'vence_pronto',
              presentationId: 'a1b2c3d4-0000-4000-8000-000000000001',
              productName: 'Arroz Diana · 500 g',
              message: 'Tu precio oficial de Arroz Diana · 500 g vence mañana: reconfírmalo.',
            },
          ],
        },
      },
    });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Avisos: 1 pendiente' })).toBeInTheDocument();
  });

  it('un reportante o quien no inició sesión no ve la campana', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    render(<App />);

    expect(
      (await screen.findAllByRole('link', { name: 'Registrar precio' })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Avisos/ })).not.toBeInTheDocument();
  });
});
