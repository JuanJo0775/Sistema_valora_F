import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductImage } from './ProductImage';

const offPhoto = {
  url: 'https://images.openfoodfacts.org/images/products/770/251/100/0014/front_es.jpg',
  source: 'open_food_facts' as const,
  attribution: 'Open Food Facts, licencia ODbL',
};

describe('imagen del producto', () => {
  it('con foto la muestra con el nombre del producto como texto alternativo', () => {
    render(<ProductImage name="Arroz blanco" image={offPhoto} />);

    expect(screen.getByRole('img', { name: 'Arroz blanco' })).toHaveAttribute('src', offPhoto.url);
  });

  it('una foto de Open Food Facts cita su fuente', () => {
    render(<ProductImage name="Arroz blanco" image={offPhoto} />);

    expect(screen.getByText('Foto: Open Food Facts, licencia ODbL')).toBeInTheDocument();
  });

  it('una foto del equipo no lleva atribución', () => {
    render(
      <ProductImage
        name="Arroz blanco"
        image={{
          url: 'http://localhost:3000/media/products/arroz.webp',
          source: 'equipo',
          attribution: 'Equipo Valora',
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(screen.queryByText(/^Foto:/)).not.toBeInTheDocument();
  });

  it('la foto es perezosa', () => {
    render(<ProductImage name="Arroz blanco" image={offPhoto} />);

    expect(screen.getByRole('img', { name: 'Arroz blanco' })).toHaveAttribute('loading', 'lazy');
  });

  it('sin foto muestra la ilustración de su categoría, oculta a lectores', () => {
    const { container } = render(<ProductImage name="Arroz blanco" category="grains-groceries" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-category', 'grains-groceries');
  });

  it('con una categoría desconocida, o ninguna, usa la ilustración genérica', () => {
    const { container, rerender } = render(<ProductImage name="Cosa" category="no-existe" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'generic');

    rerender(<ProductImage name="Cosa" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'generic');
  });

  it('si la foto no carga muestra la ilustración de la categoría', () => {
    const { container } = render(
      <ProductImage name="Arroz blanco" image={offPhoto} category="beverages" />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Arroz blanco' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'beverages');
    expect(screen.queryByText(/^Foto:/)).not.toBeInTheDocument();
  });
});
