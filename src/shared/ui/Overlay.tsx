import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import './overlay.css';

// En pantallas angostas (celular) lo que se abre es una hoja inferior; desde tablet, un popover.
const SHEET_QUERY = '(max-width: 639.98px)';

const subscribe = (notify: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const list = window.matchMedia(SHEET_QUERY);
  list.addEventListener('change', notify);
  return () => {
    list.removeEventListener('change', notify);
  };
};
const isSheet = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(SHEET_QUERY).matches;

export const useIsSheet = () => useSyncExternalStore(subscribe, isSheet, () => false);

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const GAP = 8;
const WIDTH = 360;

interface Placement {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

// El popover queda pegado al disparador: abajo si cabe, arriba si hay más lugar, sin salirse de la
// pantalla.
function place(anchor: HTMLElement): Placement {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - GAP * 2);
  const left = Math.max(GAP, Math.min(rect.right - width, window.innerWidth - width - GAP));
  const below = window.innerHeight - rect.bottom - GAP * 2;
  const above = rect.top - GAP * 2;
  if (below >= 320 || below >= above) {
    return { top: rect.bottom + GAP, left, width, maxHeight: Math.max(below, 200) };
  }
  return {
    bottom: window.innerHeight - rect.top + GAP,
    left,
    width,
    maxHeight: Math.max(above, 200),
  };
}

// Un diálogo para elegir algo: popover anclado al disparador (tablet y escritorio) u hoja inferior
// con fondo atenuado (celular). Enfoca lo marcado con data-autofocus, mantiene el Tab dentro, se
// cierra con Escape o al tocar fuera y devuelve el foco al disparador.
export function Overlay({
  anchor,
  title,
  onClose,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useIsSheet();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useLayoutEffect(() => {
    const target = anchor.current;
    if (sheet || !target) return;
    const update = () => {
      setPlacement(place(target));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor, sheet]);

  // La hoja es modal: la página de atrás no se desplaza mientras está abierta.
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = before;
    };
  }, [sheet]);

  useEffect(() => {
    const element = panel.current;
    const trigger = anchor.current;
    (element?.querySelector<HTMLElement>('[data-autofocus]') ?? element)?.focus({
      preventScroll: true,
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !element) return;
      const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (!element.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (element?.contains(target) || trigger?.contains(target)) return;
      close.current();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      trigger?.focus({ preventScroll: true });
    };
  }, [anchor]);

  const style =
    !sheet && placement
      ? {
          top: placement.top,
          bottom: placement.bottom,
          left: placement.left,
          width: placement.width,
          maxHeight: placement.maxHeight,
        }
      : undefined;
  return createPortal(
    <div className={sheet ? 'overlay overlay-sheet' : 'overlay overlay-popover'}>
      {sheet && <div className="overlay-backdrop" aria-hidden="true" />}
      <div
        ref={panel}
        className="overlay-panel"
        role="dialog"
        aria-modal={sheet ? 'true' : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        style={style}
      >
        <div className="overlay-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="overlay-close" aria-label="Cerrar" onClick={onClose}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="overlay-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
