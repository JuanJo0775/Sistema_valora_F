import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReliabilityBadge } from './ReliabilityBadge';

describe('etiqueta de confiabilidad', () => {
  it.each([
    ['alta', 'Confiabilidad alta'],
    ['media', 'Confiabilidad media'],
    ['baja', 'Confiabilidad baja'],
    ['en_revision', 'En revisión'],
  ] as const)('el nivel «%s» que calcula el backend se lee como «%s»', (level, text) => {
    render(<ReliabilityBadge level={level} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
