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

  describe('decisión con sanción', () => {
    const WITH_SANCTION = [
      { value: 'aprobar' as const, label: 'Aprobar' },
      {
        value: 'observar' as const,
        label: 'Observar cuentas',
        hint: 'Suspende por 7 días la cuenta de quien reportó.',
        confirm: 'Esto suspende la cuenta por 7 días. ¿Confirmas?',
      },
    ];
    const note = () =>
      fireEvent.change(screen.getByLabelText('Motivo de la decisión'), {
        target: { value: 'Motivo suficiente' },
      });
    const register = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Registrar decisión' }));

    it('dice qué hace la opción con una descripción visible ligada al radio', () => {
      render(
        <DecisionForm id="c" options={WITH_SANCTION} onDecide={vi.fn(() => Promise.resolve())} />,
      );
      const hint = screen.getByText('Suspende por 7 días la cuenta de quien reportó.');
      expect(screen.getByRole('radio', { name: 'Observar cuentas' })).toHaveAccessibleDescription(
        hint.textContent,
      );
      expect(screen.getByRole('radio', { name: 'Aprobar' })).not.toHaveAttribute(
        'aria-describedby',
      );
    });

    it('pide confirmación antes de enviar, con el foco en Confirmar, y envía al confirmar', async () => {
      const onDecide = vi.fn(() => Promise.resolve());
      render(<DecisionForm id="c" options={WITH_SANCTION} onDecide={onDecide} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Observar cuentas' }));
      note();

      register();

      expect(screen.getByText('Esto suspende la cuenta por 7 días. ¿Confirmas?')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
      expect(onDecide).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(onDecide).toHaveBeenCalledWith('observar', 'Motivo suficiente');
    });

    it('Cancelar no envía, cierra la confirmación y devuelve el foco al botón', () => {
      const onDecide = vi.fn(() => Promise.resolve());
      render(<DecisionForm id="c" options={WITH_SANCTION} onDecide={onDecide} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Observar cuentas' }));
      note();
      register();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(onDecide).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrar decisión' })).toHaveFocus();
    });

    it('cambiar de decisión retira la confirmación', () => {
      render(
        <DecisionForm id="c" options={WITH_SANCTION} onDecide={vi.fn(() => Promise.resolve())} />,
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Observar cuentas' }));
      note();
      register();

      fireEvent.click(screen.getByRole('radio', { name: 'Aprobar' }));

      expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    });

    it('las demás decisiones se envían sin pedir confirmación', () => {
      const onDecide = vi.fn(() => Promise.resolve());
      render(<DecisionForm id="c" options={WITH_SANCTION} onDecide={onDecide} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Aprobar' }));
      note();

      register();

      expect(onDecide).toHaveBeenCalledWith('aprobar', 'Motivo suficiente');
      expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    });

    it('sin motivo no pide confirmación: primero el aviso del motivo', () => {
      render(
        <DecisionForm id="c" options={WITH_SANCTION} onDecide={vi.fn(() => Promise.resolve())} />,
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Observar cuentas' }));

      register();

      expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('al menos 10 letras');
    });
  });
});
