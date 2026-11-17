import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';

function Demo({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        value={value}
        onValue={setValue}
      />
      <button type="submit">Enviar</button>
    </form>
  );
}

describe('Field de contraseña', () => {
  it('empieza oculta y alterna entre mostrar y ocultar', () => {
    render(<Demo onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
    const hide = screen.getByRole('button', { name: 'Ocultar contraseña' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hide);
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('el botón no envía el formulario y se conserva autoComplete', () => {
    const onSubmit = vi.fn();
    render(<Demo onSubmit={onSubmit} />);
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveAttribute('type', 'button');
    fireEvent.click(toggle);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('vuelve a ocultarse sola al enviar el formulario', () => {
    render(<Demo onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('Contraseña');
    fireEvent.change(input, { target: { value: 'secreta123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('un campo que no es contraseña no lleva el botón', () => {
    render(<Field label="Correo" type="email" value="" onValue={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
