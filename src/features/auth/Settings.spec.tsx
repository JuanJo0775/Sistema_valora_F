import { fireEvent, render, screen } from '@testing-library/react';
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

  it('tiene el enlace para volver a Yo y tres bloques con título', () => {
    renderSettings();

    expect(screen.getByRole('link', { name: /Yo/ })).toHaveAttribute('href', '/yo');
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Apariencia', 'Búsqueda', 'Pruebas del equipo']);
  });

  it('el tema se elige y queda recordado', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('el radio de búsqueda se guarda en el dispositivo', () => {
    renderSettings();
    expect(screen.getByRole('radio', { name: '1,5 km' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '3 km' }));

    expect(screen.getByRole('radio', { name: '3 km' })).toBeChecked();
    expect(localStorage.getItem('valora:radio')).toBe('3');
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
