import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../test/fakeApi';
import { App } from './App';

// Leaflet necesita un navegador de verdad para dibujar el mapa.
vi.mock('../features/stores/StoreMap', () => ({ StoreMap: () => null }));

const STORE = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';
const store = {
  id: STORE,
  name: 'Ara',
  type: 'descuento',
  address: 'Calle 21 # 15-30',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
};

const open = (path: string) => {
  window.history.pushState({}, '', path);
  render(<App />);
};

describe('botón de volver', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('la tienda vuelve al mapa', async () => {
    stubApi({
      'GET /v1/auth/session': NO_SESSION,
      [`GET /v1/establishments/${STORE}/prices`]: {
        status: 200,
        body: { establishment: store, prices: [] },
      },
    });
    open(`/tiendas/${STORE}`);

    expect(await screen.findByRole('heading', { name: 'Ara' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/mapa');
  });

  it('la política de datos vuelve a Yo', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    open('/privacidad');

    expect(await screen.findByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
  });

  it('el panel de moderación vuelve a Yo', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/moderation/queue': { status: 200, body: { items: [] } },
    });
    open('/moderacion');

    expect(await screen.findByRole('heading', { name: 'Moderación' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
  });

  it('proponer una tienda vuelve al mapa', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    open('/proponer/tienda');

    expect(await screen.findByRole('heading', { name: 'Sugerir una tienda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/mapa');
  });

  it('ajustes sigue volviendo a Yo', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    open('/yo/ajustes');

    expect(await screen.findByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/yo');
  });

  it.each(['/', '/mapa', '/canasta', '/yo', '/registrar'])(
    'la pantalla de primer nivel %s no tiene botón de volver',
    async (path) => {
      stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
      open(path);

      expect(await screen.findByRole('navigation', { name: /principal/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Volver/ })).not.toBeInTheDocument();
    },
  );
});
