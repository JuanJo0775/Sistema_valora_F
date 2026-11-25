import { useEffect, useRef, useState, type ComponentProps } from 'react';

// Lo que ocupa la barra fija de arriba más su aire (88 px) y el aire de abajo (16 px): el mismo número
// que `top` de `.side.fit` en base.css.
const TOP = 88;
const BOTTOM = 16;

// Un panel solo se queda fijo al desplazar si cabe entero en la altura útil de la ventana. Si no cabe, o
// se cortaría o tendría su propio scroll (scroll anidado), así que fluye con la página.
export const fitsWindow = (panelHeight: number, windowHeight: number) =>
  panelHeight <= windowHeight - TOP - BOTTOM;

// La columna lateral (`.side`). Mide su alto con la ventana y, cuando cabe, le pone `fit`: desde 960 px
// base.css lo deja fijo (`position: sticky`). Mientras no se mide, o si no cabe, es una caja normal.
export function SidePanel({ className, ...props }: ComponentProps<'aside'>) {
  const ref = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      setFits(fitsWindow(element.offsetHeight, window.innerHeight));
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  return (
    <aside
      ref={ref}
      className={['side', fits && 'fit', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}
