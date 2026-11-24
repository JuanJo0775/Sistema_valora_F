import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DecisionForm } from './DecisionForm';

const OPTIONS = [
  { value: 'revocar' as const, label: 'Revocar comercio' },
  { value: 'descartar' as const, label: 'Descartar caso' },
];

describe('formulario de decisión', () => {
  it('retira el aviso apenas la persona corrige lo que faltaba', () => {
    render(<DecisionForm id="caso" options={OPTIONS} onDecide={vi.fn(() => Promise.resolve())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige la decisión.');

    fireEvent.click(screen.getByRole('radio', { name: 'Descartar caso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 10 letras');

    fireEvent.change(screen.getByLabelText('Motivo de la decisión'), {
      target: { value: 'Motivo suficiente' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin decisión marca el grupo como inválido, lo liga al aviso y lleva el foco a la primera opción', () => {
    render(<DecisionForm id="caso" options={OPTIONS} onDecide={vi.fn(() => Promise.resolve())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));

    const group = screen.getByRole('radiogroup', { name: 'Decisión' });
    const alert = screen.getByRole('alert');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', alert.id);
    expect(screen.getByRole('radio', { name: 'Revocar comercio' })).toHaveFocus();
    expect(screen.getByLabelText('Motivo de la decisión')).not.toHaveAttribute('aria-invalid');
  });

  it('sin motivo marca la caja como inválida, la liga al aviso y le lleva el foco', () => {
    render(<DecisionForm id="caso" options={OPTIONS} onDecide={vi.fn(() => Promise.resolve())} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Descartar caso' }));

    fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));

    const note = screen.getByLabelText('Motivo de la decisión');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escribe el motivo: al menos 10 letras.');
    expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(note).toHaveAttribute('aria-describedby', alert.id);
    expect(note).toHaveFocus();
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.change(note, { target: { value: 'Motivo suficiente' } });
    expect(note).not.toHaveAttribute('aria-invalid');
    expect(note).not.toHaveAttribute('aria-describedby');
  });
});
