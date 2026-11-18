// Ilustración vectorial por categoría para los productos sin foto (o con la foto rota). Trazos
// simples de 64 × 64, sin texto ni marcas, que toman el color de los tokens (ver catalog.css).
// Los códigos son la lista cerrada de GET /v1/categories (migración 0003 del backend).
const ART: Record<string, string[]> = {
  'fruits-vegetables': [
    'M32 22c-6-5-18-3-18 11 0 12 8 21 14 21 2 0 3-1 4-1s2 1 4 1c6 0 14-9 14-21 0-14-12-16-18-11z',
    'M32 22c0-5 2-9 6-12',
    'M38 14c4-3 9-2 11 1-3 3-8 3-11-1z',
  ],
  'meat-fish': [
    'M8 32c8-12 24-16 34-6l-1 12c-10 10-26 6-33-6z',
    'M42 26l14-8v28l-14-8',
    'M18 30h.01',
  ],
  'dairy-eggs': ['M20 24l8-10h16v14l-4 4v26H20z', 'M20 24h20v30', 'M40 24l4-4', 'M26 36h8M26 44h8'],
  bakery: [
    'M10 34c0-10 10-18 22-18s22 8 22 18c0 4-3 6-6 6v10H16V40c-3 0-6-2-6-6z',
    'M24 26l4 8M34 24l4 8',
  ],
  'grains-groceries': [
    'M22 14h20l-3 8 9 9v23H16V31l9-9z',
    'M25 22h14',
    'M32 34v12M26 38l6-4 6 4M26 46l6-4 6 4',
  ],
  beverages: ['M28 8h8v10l5 8v28a2 2 0 0 1-2 2H25a2 2 0 0 1-2-2V26l5-8z', 'M23 34h18M23 46h18'],
  'household-cleaning': [
    'M26 24h14v6H26z',
    'M26 30l-5 6v18h20V36l-1-6',
    'M40 24l8-4v6l-8 2',
    'M26 24v-8h10',
    'M54 20l4-2M54 26l5 1',
  ],
  'personal-care': [
    'M26 8h12v6H26z',
    'M30 14v6M24 20h16a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
    'M28 34h8',
  ],
};

// Respaldo final: una bolsa de mercado genérica (ADR-020), para una categoría que no se conoce.
const GENERIC = ['M14 22h36l-3 32H17z', 'M24 22v-4a8 8 0 0 1 16 0v4'];

export function CategoryArt({ category, size }: { category?: string; size?: number }) {
  const known = category !== undefined && Object.hasOwn(ART, category);
  const paths = (known ? ART[category] : undefined) ?? GENERIC;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      data-category={known ? category : 'generic'}
    >
      {paths.map((d, i) => (
        <path key={d} d={d} className={i === 0 ? 'art-body' : 'art-line'} />
      ))}
    </svg>
  );
}
