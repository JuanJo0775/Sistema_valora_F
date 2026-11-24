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
});
