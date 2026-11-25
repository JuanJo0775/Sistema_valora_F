import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitsWindow, SidePanel } from './SidePanel';

describe('fitsWindow', () => {
  it('cabe si el panel entra entre la barra de arriba (88 px) y el aire de abajo (16 px)', () => {
    expect(fitsWindow(616, 720)).toBe(true);
    expect(fitsWindow(617, 720)).toBe(false);
    expect(fitsWindow(756, 720)).toBe(false);
    expect(fitsWindow(756, 864)).toBe(true);
  });
});

describe('SidePanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const height = (value: number) =>
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(value);

  it('es un complementario con su nombre y las clases que le pasan', () => {
    render(
      <SidePanel className="map-side" aria-label="Lista">
        Hola
      </SidePanel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Lista' });
    expect(panel).toHaveClass('side', 'map-side');
  });

  it('se marca fit solo si cabe en la ventana', () => {
    vi.stubGlobal('innerHeight', 720);
    height(500);
    const { unmount } = render(<SidePanel aria-label="Corto">x</SidePanel>);
    expect(screen.getByRole('complementary')).toHaveClass('fit');
    unmount();

    height(900);
    render(<SidePanel aria-label="Largo">x</SidePanel>);
    expect(screen.getByRole('complementary')).not.toHaveClass('fit');
  });

  it('vuelve a medir cuando cambia la ventana o el panel, y deja de observar al desmontarse', () => {
    const measureLater: (() => void)[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          measureLater.push(callback);
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    vi.stubGlobal('innerHeight', 1000);
    height(900);
    const { unmount } = render(<SidePanel aria-label="Cambia">x</SidePanel>);
    const panel = screen.getByRole('complementary');
    expect(panel).not.toHaveClass('fit');

    // El panel se encoge (llegó menos contenido): ahora cabe.
    height(300);
    act(() => {
      measureLater.forEach((measure) => {
        measure();
      });
    });
    expect(panel).toHaveClass('fit');

    // Una ventana más baja lo suelta otra vez.
    vi.stubGlobal('innerHeight', 350);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(panel).not.toHaveClass('fit');

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
