import { describe, expect, it } from 'vitest';
import { type PushEnvironment, pushStatusOf } from './pushStatus';

// Un computador con Chrome, con el servidor listo y sin haber activado nada todavía.
const READY: PushEnvironment = {
  platform: 'other',
  installed: false,
  supported: true,
  permission: 'default',
  keyAvailable: true,
  subscribed: false,
};

// Qué le dice a la persona la pantalla de avisos según su dispositivo y su estado (RN7 de RF-020).
describe('estado de los avisos push en este dispositivo (RN7)', () => {
  it('con todo listo ofrece activarlos', () => {
    expect(pushStatusOf(READY)).toBe('listo');
  });

  it('mientras no se sabe si el servidor tiene los avisos, no dice nada todavía', () => {
    expect(pushStatusOf({ ...READY, keyAvailable: undefined })).toBe('cargando');
  });

  // Sin clave configurada (la API responde 404) la opción no existe: ni siquiera la guía de iPhone.
  it('si el servidor no tiene los avisos configurados, no muestra la opción', () => {
    expect(pushStatusOf({ ...READY, keyAvailable: false })).toBe('sin_clave');
    expect(pushStatusOf({ ...READY, keyAvailable: false, platform: 'ios-safari' })).toBe(
      'sin_clave',
    );
  });
});
