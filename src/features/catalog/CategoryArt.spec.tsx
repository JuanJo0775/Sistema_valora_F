import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryArt } from './CategoryArt';

const CODES = [
  'fruits-vegetables',
  'meat-fish',
  'dairy-eggs',
  'bakery',
  'grains-groceries',
  'beverages',
  'household-cleaning',
  'personal-care',
];

describe('ilustración por categoría', () => {
  it.each(CODES)('%s tiene su propia ilustración, oculta a lectores', (code) => {
    const { container } = render(<CategoryArt category={code} />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-category', code);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
  });

  it('un nombre heredado de Object no cuenta como categoría', () => {
    const { container } = render(<CategoryArt category="constructor" />);

    expect(container.querySelector('svg')).toHaveAttribute('data-category', 'generic');
  });
});
