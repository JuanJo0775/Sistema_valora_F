import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadiusControl } from './RadiusControl';

// Como en las pantallas: quien lo usa guarda el valor que se le avisa.
function Host({
  initial,
  onChange,
  onPreview,
}: {
  initial: number;
  onChange: (km: number) => void;
  onPreview: (km: number | null) => void;
}) {
  const [km, setKm] = useState(initial);
  return (
    <RadiusControl
      radiusKm={km}
      onChange={(next) => {
        onChange(next);
        setKm(next);
      }}
      onPreview={onPreview}
    />
  );
}

function setup(radiusKm = 1.5) {
  const onChange = vi.fn();
  const onPreview = vi.fn();
  const view = render(<Host initial={radiusKm} onChange={onChange} onPreview={onPreview} />);
  const slider = screen.getByRole('slider', { name: 'Radio' });
  return { onChange, onPreview, slider, ...view };
}

describe('RadiusControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el valor grande y la barra con los topes del contrato', () => {
    const { slider } = setup(1.5);

    expect(screen.getByText('1,5 km', { selector: '.radius-value' })).toBeInTheDocument();
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '0.5');
    expect(slider).toHaveAttribute('max', '3');
    expect(slider).toHaveAttribute('step', '0.1');
    expect(slider).toHaveValue('1.5');
    expect(slider).toHaveAttribute('aria-valuetext', '1,5 kilómetros');
  });

  it('ofrece los seis chips y marca el que coincide', () => {
    setup(1.5);
    const group = screen.getByRole('radiogroup', { name: 'Radio de búsqueda' });

    expect(group.querySelectorAll('input')).toHaveLength(6);
    for (const name of ['0,5 km', '1 km', '1,5 km', '2 km', '2,5 km', '3 km']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: '1,5 km' })).toBeChecked();
  });

  it('con un valor entre preajustes no marca ningún chip', () => {
    setup(1.7);

    expect(screen.getByText('1,7 km', { selector: '.radius-value' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });

  it('arrastrar cambia al instante el valor, la barra y los chips, sin avisar todavía', () => {
    const { slider, onChange, onPreview } = setup(1.5);

    fireEvent.change(slider, { target: { value: '2' } });

    expect(screen.getByText('2 km', { selector: '.radius-value' })).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', '2 kilómetros');
    expect(screen.getByRole('radio', { name: '2 km' })).toBeChecked();
    expect(onPreview).toHaveBeenLastCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('avisa solo el valor final, ~300 ms después del último movimiento', () => {
    const { slider, onChange, onPreview } = setup(1.5);

    for (const value of ['1.6', '1.7', '1.8']) {
      fireEvent.change(slider, { target: { value } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1.8);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('al soltar el dedo o el ratón avisa de inmediato', () => {
    const { slider, onChange } = setup(1.5);

    fireEvent.change(slider, { target: { value: '2.4' } });
    fireEvent.pointerUp(slider);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2.4);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('al salir de la barra con un cambio pendiente lo avisa', () => {
    const { slider, onChange } = setup(1.5);

    fireEvent.change(slider, { target: { value: '0.9' } });
    fireEvent.blur(slider);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(0.9);
  });

  it('un chip avisa de inmediato y mueve la barra', () => {
    const { slider, onChange } = setup(1.5);

    fireEvent.click(screen.getByRole('radio', { name: '3 km' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
    expect(slider).toHaveValue('3');
    expect(screen.getByText('3 km', { selector: '.radius-value' })).toBeInTheDocument();
  });

  it('un chip cancela el cambio pendiente de la barra', () => {
    const { slider, onChange } = setup(1.5);

    fireEvent.change(slider, { target: { value: '2.2' } });
    fireEvent.click(screen.getByRole('radio', { name: '0,5 km' }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith(0.5);
  });

  it('nunca pasa de 0,5 ni de 3 km, aunque llegue otro valor', () => {
    const { slider, onChange } = setup(0.5);
    expect(slider).toHaveValue('0.5');
    expect(screen.getByRole('radio', { name: '0,5 km' })).toBeChecked();

    fireEvent.change(slider, { target: { value: '9' } });
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenLastCalledWith(3);

    expect(screen.getByText('3 km', { selector: '.radius-value' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 km' })).toBeChecked();
  });

  it('el teclado lo mueven las flechas, Inicio, Fin y RePág/AvPág nativas de la barra', () => {
    // jsdom no reproduce las teclas de un range: se comprueba que sea el nativo, enfocable y con
    // paso de 0,1, y que cada valor que el navegador le ponga (Inicio = mínimo, Fin = máximo) se acepte.
    const { slider, onChange } = setup(1.5);

    expect(slider.tagName).toBe('INPUT');
    expect(slider).not.toHaveAttribute('tabindex', '-1');
    slider.focus();
    expect(slider).toHaveFocus();

    fireEvent.change(slider, { target: { value: '1.6' } });
    expect(screen.getByText('1,6 km', { selector: '.radius-value' })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(screen.getByText('0,5 km', { selector: '.radius-value' })).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '3' } });
    expect(screen.getByText('3 km', { selector: '.radius-value' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
  });

  it('sigue el valor que llega de fuera cuando no se está arrastrando', () => {
    const { rerender } = render(<RadiusControl radiusKm={1.5} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider', { name: 'Radio' });

    rerender(<RadiusControl radiusKm={2} onChange={vi.fn()} />);

    expect(slider).toHaveValue('2');
    expect(screen.getByText('2 km', { selector: '.radius-value' })).toBeInTheDocument();
  });

  it('dibuja una marca por preajuste', () => {
    const { container } = setup(1.5);

    expect(container.querySelectorAll('.radius-tick')).toHaveLength(6);
  });
});
