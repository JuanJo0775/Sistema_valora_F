import { useRef, type KeyboardEvent } from 'react';

export type BasketTab = 'lista' | 'guardadas';

const TABS: { id: BasketTab; label: (saved: number) => string }[] = [
  { id: 'lista', label: () => 'Mi lista' },
  { id: 'guardadas', label: (saved) => `Guardadas (${String(saved)})` },
];

export const tabId = (tab: BasketTab) => `canasta-tab-${tab}`;
export const panelId = (tab: BasketTab) => `canasta-panel-${tab}`;

// «Mi lista | Guardadas (N)»: pestañas con flechas (y Inicio/Fin); la elegida se activa al llegar.
// Se ven como las fichas de la app (.category-chip).
export function BasketTabs({
  value,
  onChange,
  saved,
}: {
  value: BasketTab;
  onChange: (tab: BasketTab) => void;
  saved: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent) => {
    const at = TABS.findIndex(({ id }) => id === value);
    const target = {
      ArrowRight: (at + 1) % TABS.length,
      ArrowLeft: (at - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key];
    const next = target === undefined ? undefined : TABS[target];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    list.current?.querySelectorAll('button')[target ?? 0]?.focus();
  };
  return (
    <div ref={list} role="tablist" aria-label="Tu canasta" className="basket-tabs" onKeyDown={move}>
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={tabId(id)}
          aria-selected={id === value}
          aria-controls={panelId(id)}
          tabIndex={id === value ? 0 : -1}
          className="category-chip"
          onClick={() => {
            onChange(id);
          }}
        >
          {label(saved)}
        </button>
      ))}
    </div>
  );
}
