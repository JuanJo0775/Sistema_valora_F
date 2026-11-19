import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from './SessionProvider';
import { Settings } from './Settings';

const renderSettings = () =>
  render(
    <SessionProvider>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </SessionProvider>,
  );

describe('ajustes', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('tiene el enlace «Volver» y los bloques con título', () => {
    renderSettings();

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Apariencia', 'Accesibilidad', 'Búsqueda', 'Pruebas del equipo']);
  });
  it('«Opciones avanzadas» empieza plegada y sin aspecto de alerta', () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    renderSettings();
    const details = screen.getByText('Opciones avanzadas').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(details?.querySelector('summary')?.className).not.toMatch(/danger|bad|warn/);
    expect(screen.queryByRole('heading', { name: 'La app' })).toBeNull();
  });

  it('al abrirla ofrece desinstalar la app y, con sesión, eliminar la cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    renderSettings();
    const details = screen.getByText('Opciones avanzadas').closest('details') as HTMLDetailsElement;
    details.open = true;

    expect(screen.getByRole('link', { name: /Desinstalar la app/ })).toHaveAttribute(
      'href',
      '/yo/app',
    );
    expect(await screen.findByRole('link', { name: /Eliminar mi cuenta/ })).toHaveAttribute(
      'href',
      '/yo/eliminar-cuenta',
    );
  });

  it('sin sesión no muestra «Eliminar mi cuenta»', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderSettings();
    await waitFor(() => {
      expect(api.calls.length).toBeGreaterThan(0);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('link', { name: /Desinstalar la app/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Eliminar mi cuenta/ })).toBeNull();
  });

  it('el tema se elige y queda recordado', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('«Distinguir los tipos de tienda por su forma» empieza apagado y se recuerda', () => {
    const { unmount } = renderSettings();
    const toggle = () =>
      screen.getByRole('switch', { name: 'Distinguir los tipos de tienda por su forma' });
    expect(toggle()).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('valora:pines-forma')).toBe('1');
    unmount();
    renderSettings();
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle());
    expect(localStorage.getItem('valora:pines-forma')).toBeNull();
  });

  it('el radio de búsqueda se guarda en el dispositivo', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: '1,5 km' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '3 km' }));

    expect(screen.getByRole('radio', { name: '3 km' })).toBeChecked();
    expect(localStorage.getItem('valora:radio')).toBe('3');
  });

  it('la barra del radio lo mueve y se guarda al soltar', () => {
    renderSettings();
    const slider = screen.getByRole('slider', { name: 'Radio' });
    expect(slider).toHaveValue('1.5');

    fireEvent.change(slider, { target: { value: '2.4' } });
    expect(localStorage.getItem('valora:radio')).toBeNull();
    fireEvent.pointerUp(slider);

    expect(localStorage.getItem('valora:radio')).toBe('2.4');
    expect(screen.getByText('2,4 km', { selector: '.radius-value' })).toBeInTheDocument();
  });

  it('el municipio se elige y queda recordado', () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText('Municipio'), { target: { value: 'calarca' } });

    expect(screen.getByLabelText('Municipio')).toHaveValue('calarca');
    expect(localStorage.getItem('valora:municipio')).toBe('calarca');
  });

  it('el modo prueba de usabilidad se enciende y queda recordado', () => {
    renderSettings();
    const mode = screen.getByRole('switch', { name: 'Modo prueba de usabilidad' });
    expect(mode).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/solo para pruebas con personas/i)).toBeInTheDocument();

    fireEvent.click(mode);

    expect(mode).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('valora:modo-prueba')).toBe('1');
    fireEvent.click(mode);
    expect(localStorage.getItem('valora:modo-prueba')).toBeNull();
  });
});
