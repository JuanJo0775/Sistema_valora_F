import { render, screen } from '@testing-library/react';
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

  it('sin foto muestra una ilustración genérica', () => {
    render(<ProductImage name="Arroz blanco" />);

    expect(screen.getByRole('img', { name: 'Arroz blanco (sin foto)' })).toBeInTheDocument();
  });
});
