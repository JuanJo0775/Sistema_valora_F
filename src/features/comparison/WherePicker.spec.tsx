import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubLocation } from '../../test/location';
import { useWhere } from './useWhere';
import { WherePicker } from './WherePicker';

function Harness({
  showRadius,
  onLeaveLocation,
}: {
  showRadius?: boolean;
  onLeaveLocation?: () => void;
}) {
  const where = useWhere();
  return (
    <>
      <p>{`consulta: ${JSON.stringify(where.query)}`}</p>
      <WherePicker where={where} showRadius={showRadius} onLeaveLocation={onLeaveLocation} />
    </>
  );
}

// jsdom no resuelve media queries: se simula el ancho de un celular.
const stubPhone = (phone: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: phone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

const trigger = (name: string | RegExp = /^Dónde buscar/) => screen.getByRole('button', { name });
const open = () => {
  fireEvent.click(trigger());
};

describe('el «¿Dónde?»', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('el botón dice dónde se busca y avisa que abre un diálogo', () => {
    render(<Harness />);

    const button = trigger('Dónde buscar: Armenia');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Armenia');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('al abrirlo muestra los 12 municipios en una lista propia, con el actual marcado', () => {
    render(<Harness />);

    open();

    const dialog = screen.getByRole('dialog', { name: '¿Dónde buscar?' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const list = within(dialog).getByRole('listbox', { name: 'Municipio' });
    expect(within(list).getAllByRole('option')).toHaveLength(12);
    expect(within(list).getByRole('option', { name: 'Armenia' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(dialog.querySelector('select')).toBeNull();
    // La lista recibe el foco para recorrerla con el teclado.
    expect(list).toHaveFocus();
  });

  it('elegir un municipio se aplica de inmediato, cierra y se recuerda', () => {
    render(<Harness />);
    open();

    fireEvent.click(screen.getByRole('option', { name: 'Calarcá' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger('Dónde buscar: Calarcá')).toBeInTheDocument();
    expect(screen.getByText('consulta: {"municipality":"calarca"}')).toBeInTheDocument();
    expect(localStorage.getItem('valora:municipio')).toBe('calarca');
  });

  it('con teclado: la flecha abre, las flechas recorren, Enter elige y el foco vuelve al botón', () => {
    render(<Harness />);
    trigger().focus();

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox', { name: 'Municipio' });
    expect(list).toHaveFocus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-1$/);
    fireEvent.keyDown(list, { key: 'Enter' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger('Dónde buscar: Buenavista')).toHaveFocus();
  });

  it('Inicio, Fin y escribir una letra mueven la opción activa', () => {
    render(<Harness />);
    open();
    const list = screen.getByRole('listbox', { name: 'Municipio' });

    fireEvent.keyDown(list, { key: 'End' });
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-11$/);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-0$/);
    fireEvent.keyDown(list, { key: 'q' });
    fireEvent.keyDown(list, { key: 'Enter' });

    expect(trigger('Dónde buscar: Quimbaya')).toBeInTheDocument();
  });

  it('Escape cierra sin cambiar nada y devuelve el foco al botón', () => {
    render(<Harness />);
    open();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger('Dónde buscar: Armenia')).toHaveFocus();
  });

  it('«Cerrar», «Listo» y tocar fuera también cierran', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    open();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Tab no se escapa del diálogo: del último vuelve al primero y Mayús+Tab al revés', () => {
    render(<Harness />);
    open();
    const dialog = screen.getByRole('dialog');
    const first = within(dialog).getByRole('button', { name: 'Cerrar' });
    const last = within(dialog).getByRole('button', { name: 'Listo' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('con 8 o más opciones se puede escribir para filtrar, sin tildes, y dice si no hay', () => {
    render(<Harness />);
    open();
    const search = screen.getByRole('searchbox', { name: 'Buscar municipio' });

    fireEvent.change(search, { target: { value: 'calarca' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(trigger('Dónde buscar: Calarcá')).toBeInTheDocument();

    open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Sin resultados');
  });

  describe('usar mi ubicación', () => {
    it('explica la privacidad, cambia el botón a «Cerca de mí · 1,5 km» y muestra el radio', async () => {
      stubLocation();
      render(<Harness />);
      open();
      expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toHaveAccessibleDescription(
        /no se guarda/,
      );
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

      expect(await screen.findByRole('slider', { name: 'Radio' })).toBeInTheDocument();
      expect(trigger('Dónde buscar: Cerca de mí · 1,5 km')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cerca de mí' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(localStorage.getItem('valora:donde')).toBe('ubicacion');
      // La ubicación nunca se guarda (EC-08): solo el modo.
      expect(JSON.stringify(Object.entries(localStorage))).not.toMatch(/4\.53|-75\.68/);
    });

    it('el radio se cambia con los chips y el botón lo dice', async () => {
      stubLocation();
      render(<Harness />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

      fireEvent.click(await screen.findByRole('radio', { name: '2 km' }));

      expect(trigger('Dónde buscar: Cerca de mí · 2 km')).toBeInTheDocument();
      expect(screen.getByText(/"radiusKm":2/)).toBeInTheDocument();
    });

    it('sin radio cuando la pantalla tiene su propia barra (el mapa)', async () => {
      stubLocation();
      render(<Harness showRadius={false} />);
      open();

      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

      await screen.findByRole('button', { name: 'Cerca de mí' });
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('con el permiso negado dice qué hacer, sigue en el municipio y no guarda el modo', async () => {
      stubLocation('deny');
      render(<Harness />);
      open();

      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Activa la ubicación del navegador');
      expect(alert).toHaveTextContent('candado de la barra de direcciones');
      expect(trigger('Dónde buscar: Armenia')).toBeInTheDocument();
      expect(localStorage.getItem('valora:donde')).toBeNull();
    });

    it('si ya estaba negado, el aviso queda visible en la pantalla con el diálogo cerrado', async () => {
      stubLocation('deny');
      localStorage.setItem('valora:donde', 'ubicacion');

      render(<Harness />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Activa la ubicación');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('elegir un municipio deja la ubicación, avisa a la pantalla y olvida el modo', async () => {
      stubLocation();
      const left = vi.fn();
      render(<Harness onLeaveLocation={left} />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
      await screen.findByRole('slider');
      for (const option of screen.getAllByRole('option')) {
        expect(option).toHaveAttribute('aria-selected', 'false');
      }

      fireEvent.click(screen.getByRole('option', { name: 'Armenia' }));

      expect(left).toHaveBeenCalledOnce();
      expect(trigger('Dónde buscar: Armenia')).toBeInTheDocument();
      expect(localStorage.getItem('valora:donde')).toBeNull();
    });
  });

  describe('según el ancho', () => {
    it('en celular es una hoja inferior modal con fondo atenuado', () => {
      stubPhone(true);
      render(<Harness />);

      open();

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(document.querySelector('.overlay-sheet .overlay-backdrop')).not.toBeNull();
      expect(document.documentElement.style.overflow).toBe('hidden');

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      expect(document.documentElement.style.overflow).toBe('');
    });

    it('en tablet y escritorio es un popover anclado, sin fondo atenuado ni bloquear la página', () => {
      stubPhone(false);
      render(<Harness />);

      open();

      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal');
      expect(document.querySelector('.overlay-popover')).not.toBeNull();
      expect(document.querySelector('.overlay-backdrop')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
    });
  });
});
