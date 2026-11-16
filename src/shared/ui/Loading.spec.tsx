import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Loading } from './Loading';

describe('cargando', () => {
  it('avisa «Cargando…» también a los lectores de pantalla', () => {
    render(<Loading />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });
});
