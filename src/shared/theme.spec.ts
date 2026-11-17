import { beforeEach, describe, expect, it } from 'vitest';
import { applyStoredTheme, getTheme, setTheme } from './theme';

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('sin elección sigue al sistema y no pone data-theme', () => {
    applyStoredTheme();
    expect(getTheme()).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('guarda y aplica el tema oscuro y el claro', () => {
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(getTheme()).toBe('dark');
    setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('volver a «Sistema» quita la elección', () => {
    setTheme('dark');
    setTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(getTheme()).toBe('system');
  });

  it('al arrancar aplica el tema guardado', () => {
    setTheme('light');
    delete document.documentElement.dataset.theme;
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
