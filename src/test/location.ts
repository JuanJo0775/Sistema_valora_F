import { vi } from 'vitest';

// El teléfono responde la ubicación al instante (cerca del centro de Armenia), o la niega.
export function stubLocation(answer: 'allow' | 'deny' = 'allow') {
  const geolocation = {
    getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => {
      if (answer === 'allow') {
        ok({ coords: { latitude: 4.53, longitude: -75.68 } } as GeolocationPosition);
      } else {
        fail({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      }
    },
  };
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator) as Navigator, { geolocation }));
}

// Un navegador sin geolocalización (o una página sin HTTPS).
export function stubNoGeolocation() {
  vi.stubGlobal(
    'navigator',
    Object.assign(Object.create(navigator) as Navigator, { geolocation: undefined }),
  );
}
