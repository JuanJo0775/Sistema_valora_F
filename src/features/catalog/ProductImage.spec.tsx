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
});
