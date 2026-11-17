import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonDetail, SkeletonList } from './Skeleton';

describe('esqueletos', () => {
  it('la pieza es decorativa: oculta a los lectores de pantalla', () => {
    const { container } = render(<Skeleton variant="circle" />);

    const piece = container.querySelector('.skeleton');
    expect(piece).toHaveClass('circle');
    expect(piece).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    ['card', 'product-cards', '.skeleton-card'],
    ['row', 'results', '.skeleton-row'],
    ['offer', 'skeleton-offers', '.skeleton-offer'],
  ] as const)('la lista «%s» avisa «Cargando…» y oculta las piezas', (kind, listClass, item) => {
    const { container } = render(<SkeletonList kind={kind} count={4} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Cargando…');
    expect(screen.getByText('Cargando…')).toHaveClass('sr-only');
    const list = container.querySelector('ul');
    expect(list).toHaveClass(listClass);
    expect(list).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll(item)).toHaveLength(4);
  });

  it('admite otro texto accesible', () => {
    render(<SkeletonList kind="row" text="Buscando tiendas…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Buscando tiendas…');
  });

  it('las miniaturas miden lo mismo que las reales (64 px y 44 px)', () => {
    const { container } = render(
      <>
        <SkeletonList kind="card" count={1} />
        <SkeletonList kind="row" count={1} />
      </>,
    );

    expect(container.querySelector('.skeleton-card .thumb-card')).toBeInTheDocument();
    expect(container.querySelector('.skeleton-row .thumb-row')).toBeInTheDocument();
  });

  it('el detalle avisa «Cargando…»', () => {
    render(<SkeletonDetail />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Cargando…');
  });
});
