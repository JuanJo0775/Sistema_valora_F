import type { Platform } from '../../../pwa/install';

// Lo que se sabe de este dispositivo y del servidor para decidir qué mostrar (RN7 de RF-020).
export interface PushEnvironment {
  platform: Platform;
  // La app abierta desde el ícono de la pantalla de inicio.
  installed: boolean;
  // El navegador tiene service worker, Push y Notification.
  supported: boolean;
  permission: 'default' | 'granted' | 'denied';
  // Si el servidor tiene los avisos configurados (GET /v1/notifications/vapid-public-key); `undefined`
  // mientras no responde.
  keyAvailable: boolean | undefined;
  // Si este dispositivo ya tiene una suscripción.
  subscribed: boolean;
}

export type PushStatus =
  | 'cargando'
  | 'sin_clave'
  | 'listo'
  | 'activo'
  | 'denegado'
  | 'sin_soporte'
  | 'ios_sin_instalar'
  | 'ios_otro_navegador';

// Qué situación es: la pantalla de avisos dice a la persona el paso que le falta.
export function pushStatusOf(env: PushEnvironment): PushStatus {
  if (env.keyAvailable === undefined) return 'cargando';
  if (!env.keyAvailable) return 'sin_clave';
  // iOS solo permite avisos a una app instalada: en Safari normal el navegador ni tiene Push, así que
  // «sin soporte» sería engañoso. Otro navegador o la ventana de otra app no se pueden instalar.
  if (env.platform === 'ios-other') return 'ios_otro_navegador';
  if (env.platform === 'ios-safari' && !env.installed) return 'ios_sin_instalar';
  if (!env.supported) return 'sin_soporte';
  if (env.permission === 'denied') return 'denegado';
  if (env.permission === 'granted' && env.subscribed) return 'activo';
  return 'listo';
}
