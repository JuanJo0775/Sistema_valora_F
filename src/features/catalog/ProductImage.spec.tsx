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

  it('la foto lleva decoding async, ancho y alto reservados y el marco cuadrado del detalle', () => {
    const { container } = render(<ProductImage name="Arroz blanco" image={offPhoto} />);

    const img = screen.getByRole('img', { name: 'Arroz blanco' });
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '144');
    expect(img).toHaveAttribute('height', '144');
    expect(container.querySelector('.product-frame')).toHaveClass('detail');
  });

  it('una foto diminuta cae a la ilustración y deja de citar la fuente', () => {
    const { container } = render(
      <ProductImage name="Arroz blanco" image={offPhoto} category="beverages" />,
    );
    const img = screen.getByRole('img', { name: 'Arroz blanco' });
    Object.defineProperty(img, 'naturalWidth', { value: 40 });
    Object.defineProperty(img, 'naturalHeight', { value: 40 });

    fireEvent.load(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'beverages');
    expect(screen.queryByText(/^Foto:/)).not.toBeInTheDocument();
  });

  it('una vez cargada, tocar la foto la amplía y Cerrar la devuelve', () => {
    render(<ProductImage name="Arroz blanco" image={offPhoto} />);
    const img = screen.getByRole('img', { name: 'Arroz blanco' });
    Object.defineProperty(img, 'naturalWidth', { value: 400 });
    Object.defineProperty(img, 'naturalHeight', { value: 300 });
    fireEvent.load(img);

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar la foto de Arroz blanco' }));
    expect(screen.getByRole('dialog', { name: 'Arroz blanco', hidden: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar', hidden: true }));

    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });
});
