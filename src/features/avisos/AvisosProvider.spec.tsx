import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, sessionAs, stubApi } from '../../test/fakeApi';
import { SessionProvider } from '../auth/SessionProvider';
import { AvisosProvider } from './AvisosProvider';
import { useAvisos } from './avisosContext';

// Muestra lo que el proveedor entrega, para probarlo sin depender de la campana.
function Probe() {
  const avisos = useAvisos();
  return <p data-testid="avisos">{JSON.stringify(avisos)}</p>;
}

const renderProvider = () =>
  render(
    <SessionProvider>
      <AvisosProvider>
        <Probe />
      </AvisosProvider>
    </SessionProvider>,
  );

const SUMMARY = { precios: 2, tiendas: 0, productos: 1, comercios: 3 };

// ADR-043: el moderador usa el resumen de moderación; el comercio, sus avisos.
describe('de dónde salen los avisos de cada rol (ADR-043)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('el moderador recibe los pendientes de cada cola', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/moderation/summary': { status: 200, body: SUMMARY },
    });

    renderProvider();

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('avisos').textContent ?? '')).toEqual({
        kind: 'moderador',
        counts: SUMMARY,
      });
    });
  });

  it('el comercio recibe sus avisos de vencimiento y de discrepancia', async () => {
    const alert = {
      kind: 'vence_pronto',
      presentationId: 'a1b2c3d4-0000-4000-8000-000000000001',
      productName: 'Arroz Diana · 500 g',
      message: 'Tu precio oficial de Arroz Diana · 500 g vence mañana: reconfírmalo.',
    };
    stubApi({
      'GET /v1/auth/session': sessionAs('comercio'),
      'GET /v1/commerce/alerts': { status: 200, body: { items: [alert] } },
    });

    renderProvider();

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('avisos').textContent ?? '')).toEqual({
        kind: 'comercio',
        alerts: [alert],
      });
    });
  });
});
