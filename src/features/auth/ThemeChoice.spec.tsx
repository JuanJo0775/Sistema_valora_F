import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeChoice } from './ThemeChoice';

describe('ThemeChoice', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('empieza en «Sistema» y deja elegir oscuro y claro', () => {
    render(<ThemeChoice />);
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
