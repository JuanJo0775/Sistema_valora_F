import { vi } from 'vitest';

// Un navegador de prueba con su propia geolocalización. `onLine` se sigue leyendo del navegador
// real: sus accesores no admiten otro objeto como receptor.
function stubNavigator(geolocation: unknown) {
  const real = navigator;
  const fake = Object.assign(Object.create(real) as Navigator, { geolocation });
  Object.defineProperty(fake, 'onLine', { get: () => real.onLine });
  vi.stubGlobal('navigator', fake);
}

// El teléfono responde la ubicación al instante (cerca del centro de Armenia), o la niega.
export function stubLocation(answer: 'allow' | 'deny' = 'allow') {
  stubNavigator({
    getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
      if (answer === 'allow') {
        ok({ coords: { latitude: 4.53, longitude: -75.68 } } as GeolocationPosition);
      } else {
        fail({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      }
    },
  });
}

// Un navegador sin geolocalización (o una página sin HTTPS).
export function stubNoGeolocation() {
  stubNavigator(undefined);
}
