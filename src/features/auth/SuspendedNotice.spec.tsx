import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SuspendedNotice } from './SuspendedNotice';

const UNTIL = '2026-12-01T17:00:00Z';
const renderNotice = (props: { reason?: string; onReports?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <SuspendedNotice until={UNTIL} {...props} />
    </MemoryRouter>,
  );

describe('aviso de cuenta suspendida', () => {
  it('sin motivo dice lo de siempre y ofrece el enlace a Mis aportes', () => {
    renderNotice();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 1 de diciembre de 2026. Mientras tanto puedes ver el estado de tus aportes y apelar.',
    );
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
  });

  it.each([
    [
      'observada_por_moderacion',
      'Moderación observó tu cuenta por un reporte de precio; esa decisión no se apela.',
    ],
    ['descartes_seguidos', 'Varios de tus reportes seguidos fueron descartados.'],
  ])('con el motivo %s lo explica con una frase simple', (reason, sentence) => {
    renderNotice({ reason });

    expect(screen.getByRole('alert')).toHaveTextContent(sentence);
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toBeInTheDocument();
  });

  it('con observada_por_moderacion no ofrece apelar esa decisión (H34)', () => {
    renderNotice({ reason: 'observada_por_moderacion' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('puedes ver el estado de tus aportes.');
    expect(alert).not.toHaveTextContent('y apelar');
  });

  it('no_registrada no muestra ninguna frase inventada (H33)', () => {
    renderNotice({ reason: 'no_registrada' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 1 de diciembre de 2026. Mientras tanto puedes ver el estado de tus aportes y apelar.',
    );
  });

  it('un motivo que la app no conoce no inventa ninguna frase', () => {
    renderNotice({ reason: 'otro_motivo_nuevo' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 1 de diciembre de 2026. Mientras tanto puedes ver el estado de tus aportes y apelar.',
    );
  });

  it('dentro de Mis aportes no se enlaza a sí misma y explica cómo apelar', () => {
    renderNotice({ onReports: true });

    expect(screen.queryByRole('link', { name: 'Ver mis aportes' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Para apelar, busca el reporte descartado y pulsa «Apelar».',
    );
  });
});
