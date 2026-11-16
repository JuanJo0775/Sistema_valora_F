import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FreshnessBadge } from './FreshnessBadge';

// 15 de noviembre de 2026, 10:00 en Colombia (UTC-5).
const now = new Date('2026-11-15T15:00:00Z');

describe('etiqueta de vigencia', () => {
  it.each([
    ['2026-11-15T13:00:00Z', 'Hoy'],
    // 14-nov a las 21:00 en Colombia: ya es «ayer», aunque en UTC sea el 15.
    ['2026-11-15T02:00:00Z', 'Ayer'],
    ['2026-11-12T15:00:00Z', 'Hace 3 días'],
  ])('un precio vigente visto el %s dice «%s» (días de Colombia)', (observedAt, text) => {
    render(<FreshnessBadge freshness="vigente" observedAt={observedAt} now={now} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
