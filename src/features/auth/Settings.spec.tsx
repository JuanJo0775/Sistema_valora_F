import { fireEvent, render, screen } from '@testing-library/react';
import { choose } from '../../test/choose';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { Settings } from './Settings';

const renderSettings = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );

describe('ajustes', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('tiene el enlace «Volver» y cuatro bloques con título', () => {
    renderSettings();

    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Apariencia', 'Accesibilidad', 'Búsqueda', 'Pruebas del equipo']);
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

  it('el municipio se elige y queda recordado', async () => {
    renderSettings();

    await choose('Municipio', 'Calarcá');

    expect(screen.getByRole('button', { name: /^Municipio/ })).toHaveTextContent('Calarcá');
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
