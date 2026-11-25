import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OfficialBadge } from './OfficialBadge';

it('dice «Precio oficial» con texto y con una forma propia, no solo con color', () => {
  const { container } = render(<OfficialBadge />);
  const badge = screen.getByText('Precio oficial');
  expect(badge).toHaveClass('pill', 'official');
  // El icono es decorativo: el nombre accesible es el texto.
  const icon = container.querySelector('svg');
  expect(icon).toHaveAttribute('aria-hidden', 'true');
});
