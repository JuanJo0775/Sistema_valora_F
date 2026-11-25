import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const FEW = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
  { value: 'c', label: 'Tres' },
];
const MANY = Array.from({ length: 9 }, (_, index) => ({
  value: `v${String(index)}`,
  label: `Opción ${String(index + 1)}`,
}));

function Field({ options = FEW }: { options?: { value: string; label: string }[] }) {
  const [value, setValue] = useState(options[0]?.value ?? '');
  return <SelectField label="Número" value={value} options={options} onChange={setValue} />;
}

const field = () => screen.getByRole('button', { name: /^Número/ });

describe('campo de lista (SelectField)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra su etiqueta y la opción elegida, sin usar un <select> del sistema', () => {
    const { container } = render(<Field />);

    expect(field()).toHaveAccessibleName('Número Uno');
    expect(field()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('select')).toBeNull();
  });

  it('la lista larga se ofrece en dos columnas (por CSS, en pantallas anchas) y la corta no', () => {
    const { unmount } = render(<Field options={MANY} />);
    fireEvent.click(field());
    const list = screen.getByRole('listbox', { name: 'Número' });
    expect(list).toHaveClass('option-items-cols');
    expect(list.style.getPropertyValue('--option-rows')).toBe('5');
    unmount();

    render(<Field />);
    fireEvent.click(field());
    const short = screen.getByRole('listbox', { name: 'Número' });
    expect(short).not.toHaveClass('option-items-cols');
    expect(short.style.getPropertyValue('--option-rows')).toBe('');
  });

  it('al filtrar, las columnas se reparten entre las opciones que quedan', () => {
    render(<Field options={MANY} />);
    fireEvent.click(field());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Opción 1' } });
    expect(screen.getByRole('listbox').style.getPropertyValue('--option-rows')).toBe('1');
  });

  it('abre una lista con la opción elegida marcada y elegir otra cierra y cambia el valor', () => {
    render(<Field />);

    fireEvent.click(field());
    expect(screen.getByRole('option', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Tres' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field()).toHaveTextContent('Tres');
    expect(field()).toHaveFocus();
  });

  it('con el teclado: recorre con las flechas, elige con Espacio y Escape cierra', () => {
    render(<Field />);
    field().focus();

    fireEvent.click(field());
    const list = screen.getByRole('listbox', { name: 'Número' });
    expect(list).toHaveFocus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: ' ' });
    expect(field()).toHaveTextContent('Tres');

    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(field()).toHaveTextContent('Tres');
  });

  it('desde 8 opciones trae un campo para filtrar', () => {
    render(<Field options={MANY} />);

    fireEvent.click(field());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar número' }), {
      target: { value: 'opcion 9' },
    });

    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('en celular se abre como hoja inferior', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    render(<Field />);

    fireEvent.click(field());

    expect(screen.getByRole('dialog', { name: 'Número' })).toHaveAttribute('aria-modal', 'true');
  });
});
