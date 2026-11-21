import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoogleSignIn } from './GoogleSignIn';

describe('botón «Continuar con Google»', () => {
  // Google pide su «G» de colores en el botón de inicio de sesión. Es decorativa: el lector de pantalla
  // sigue leyendo solo «Continuar con Google» (WCAG 2.2: el nombre no se duplica con el logo).
  it('muestra la «G» de Google como imagen decorativa sin cambiar el nombre del botón', () => {
    render(<GoogleSignIn />);

    const link = screen.getByRole('link', { name: 'Continuar con Google' });
    const logo = link.querySelector('svg');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).toHaveAttribute('focusable', 'false');
  });
});
