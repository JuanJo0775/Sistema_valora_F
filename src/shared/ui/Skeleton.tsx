import type { CSSProperties } from 'react';
import './skeleton.css';

type Variant = 'line' | 'block' | 'circle';

// Pieza básica de un esqueleto: una barra de texto, un bloque o un círculo. Es decoración: va
// oculta a los lectores de pantalla (el aviso «Cargando…» lo da el contenedor, SkeletonList).
export function Skeleton({
  variant = 'line',
  width,
  height,
  className = '',
}: {
  variant?: Variant;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}) {
  return (
    <span
      className={`skeleton ${variant} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// Misma forma y tamaño que ProductThumb (64 px en tarjetas, 44 px en filas): sin saltos al cargar.
export function SkeletonThumb({ size }: { size: 'card' | 'row' }) {
  return <Skeleton variant="block" className={`thumb-${size}`} />;
}

// Tarjeta del Inicio (ProductCard): miniatura, nombre, presentación, precio y botón.
export function SkeletonCard() {
  return (
    <li className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card-link">
        <div className="skeleton-card-top">
          <SkeletonThumb size="card" />
          <Skeleton width="6rem" height="1.5rem" className="skeleton-pill" />
        </div>
        <Skeleton width="70%" className="skeleton-title" />
        <Skeleton width="40%" className="skeleton-sub" />
        <div className="skeleton-card-price">
          <span className="skeleton-lines">
            <Skeleton width="2.5rem" />
            <Skeleton width="6rem" height="1.6rem" />
          </span>
          <span className="skeleton-lines skeleton-store">
            <Skeleton width="5rem" />
            <Skeleton width="3rem" />
          </span>
        </div>
      </div>
      <Skeleton variant="block" className="skeleton-button" />
    </li>
  );
}

// Fila de resultados (búsqueda, sugerencias, tiendas, listas): miniatura de 44 px y tres líneas.
export function SkeletonRow() {
  return (
    <li className="result skeleton-row" aria-hidden="true">
      <SkeletonThumb size="row" />
      <span className="skeleton-lines">
        <Skeleton width="60%" />
        <Skeleton width="85%" />
        <Skeleton width="45%" />
      </span>
    </li>
  );
}

// Fila de una oferta por tienda (AllStores): puesto, tienda y precio a la derecha.
export function SkeletonOffer() {
  return (
    <li className="skeleton-offer" aria-hidden="true">
      <Skeleton variant="block" className="skeleton-rank" />
      <span className="skeleton-lines">
        <Skeleton width="55%" />
        <Skeleton width="80%" />
      </span>
      <Skeleton width="4.5rem" height="1.15rem" />
    </li>
  );
}

const ITEMS = { card: SkeletonCard, row: SkeletonRow, offer: SkeletonOffer } as const;
const LIST_CLASS = { card: 'product-cards', row: 'results', offer: 'skeleton-offers' } as const;

// Lista de esqueletos. El contenedor avisa a los lectores de pantalla (role="status",
// aria-busy) con un texto oculto; las piezas son decorativas.
export function SkeletonList({
  kind,
  count = 3,
  text = 'Cargando…',
}: {
  kind: keyof typeof ITEMS;
  count?: number;
  text?: string;
}) {
  const Item = ITEMS[kind];
  return (
    <div role="status" aria-busy="true" className="skeleton-wrap">
      <span className="sr-only">{text}</span>
      <ul className={LIST_CLASS[kind]} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <Item key={index} />
        ))}
      </ul>
    </div>
  );
}

// Detalle de producto: foto de 96 px, nombre, presentación y bloque de precios.
export function SkeletonDetail({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div role="status" aria-busy="true" className="skeleton-wrap">
      <span className="sr-only">{text}</span>
      <div className="detail skeleton-detail" aria-hidden="true">
        <div className="detail-head">
          <Skeleton variant="block" className="skeleton-photo" />
          <div className="detail-title">
            <Skeleton width="75%" height="1.8rem" />
            <Skeleton width="45%" />
            <Skeleton width="30%" />
          </div>
        </div>
        <Skeleton variant="block" className="skeleton-panel" />
      </div>
    </div>
  );
}
