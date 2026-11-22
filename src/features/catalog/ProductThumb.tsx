import type { components } from '../../shared/api/schema';
import { ProductFrame } from './ProductFrame';

type Image = components['schemas']['ProductImage'];

// Miniatura de las tarjetas y las filas (Inicio, búsqueda, sugerencias, canasta, tienda). Decorativa:
// el nombre del producto ya está en texto al lado, así que no se lee dos veces. Usa el marco único
// (ProductFrame): tamaño fijo, sin saltos de diseño. ADR-020: la atribución completa de Open Food
// Facts queda en el detalle; aquí va en el title.
export function ProductThumb({
  image,
  size,
  category,
}: {
  image?: Image;
  size: 'card' | 'row';
  // Código de la categoría: sin foto (o con la foto rota o diminuta) se dibuja su ilustración.
  category?: string;
}) {
  const credit = image?.source === 'open_food_facts' ? `Foto: ${image.attribution}` : undefined;
  return <ProductFrame image={image} category={category} size={size} title={credit} />;
}
