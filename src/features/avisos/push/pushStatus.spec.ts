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

  it('con una suscripción y el permiso concedido, los avisos están activos', () => {
    expect(pushStatusOf({ ...READY, permission: 'granted', subscribed: true })).toBe('activo');
  });

  // Quien bloqueó los avisos no puede volver a pedirlos desde la página: hay que decirle dónde.
  it('si bloqueó los avisos, dice que hay que permitirlos en el navegador', () => {
    expect(pushStatusOf({ ...READY, permission: 'denied' })).toBe('denegado');
  });

  it('con el permiso concedido pero sin suscripción, se puede activar de nuevo', () => {
    expect(pushStatusOf({ ...READY, permission: 'granted', subscribed: false })).toBe('listo');
  });
});
