import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductThumb } from './ProductThumb';

const offPhoto = {
  url: 'https://images.openfoodfacts.org/images/products/770/251/100/0014/front_es.jpg',
  source: 'open_food_facts' as const,
  attribution: 'Open Food Facts, licencia ODbL',
};

describe('miniatura del producto', () => {
  it('con foto muestra una imagen decorativa de tamaño fijo, perezosa', () => {
    const { container } = render(<ProductThumb image={offPhoto} size="card" />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', offPhoto.url);
    // El nombre ya está en texto al lado: el alt vacío evita leerlo dos veces.
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
    expect(container.firstElementChild).toHaveClass('product-thumb', 'card');
  });

  it('las filas usan el tamaño pequeño', () => {
    const { container } = render(<ProductThumb image={offPhoto} size="row" />);

    expect(container.querySelector('img')).toHaveAttribute('width', '44');
  });

  it('una foto de Open Food Facts cita la fuente en el title, no a la vista', () => {
    const { container } = render(<ProductThumb image={offPhoto} size="card" />);

    expect(container.firstElementChild).toHaveAttribute(
      'title',
      'Foto: Open Food Facts, licencia ODbL',
    );
    expect(container).not.toHaveTextContent('Foto:');
  });

  it('una foto del equipo no lleva title de atribución', () => {
    const { container } = render(
      <ProductThumb
        image={{ url: 'http://x/a.webp', source: 'equipo', attribution: 'Equipo Valora' }}
        size="card"
      />,
    );

    expect(container.firstElementChild).not.toHaveAttribute('title');
  });

  it('sin foto muestra la ilustración genérica, oculta a lectores', () => {
    const { container } = render(<ProductThumb size="card" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('si la foto no carga vuelve a la ilustración', () => {
    const { container } = render(<ProductThumb image={offPhoto} size="row" />);

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('sin foto dibuja la ilustración de su categoría', () => {
    const { container } = render(<ProductThumb size="card" category="household-cleaning" />);

    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'household-cleaning');
  });

  it('con una categoría desconocida usa la genérica', () => {
    const { container } = render(<ProductThumb size="row" category="no-existe" />);

    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'generic');
  });

  it('si la foto no carga dibuja la ilustración de su categoría', () => {
    const { container } = render(<ProductThumb image={offPhoto} size="row" category="bakery" />);

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'bakery');
  });
});
