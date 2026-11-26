import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';

export type TabItem = {
  id: string;
  // Puede llevar más que texto, por ejemplo el número de pendientes (ADR-043).
  label: ReactNode;
  content: ReactNode;
  // Conserva el contenido montado (oculto) al salir de la pestaña, para no perder lo que se escribió.
  keepMounted?: boolean;
};

// Patrón WAI-ARIA de pestañas con activación automática: la flecha mueve el foco y activa la pestaña
// a la vez; solo la pestaña activa está en el orden de Tab (las demás, con tabindex -1). Inicio y
// Fin saltan a los extremos, y las flechas dan la vuelta. Las pestañas siguen siendo los mismos
// botones al cambiar, así que el foco no se pierde.
export function Tabs({
  label,
  tabs,
  value,
  onChange,
  className,
  tabClassName,
  panelClassName,
}: {
  label: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  tabClassName?: string;
  panelClassName?: string;
}) {
  const base = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index + last) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    const next = target === null ? undefined : tabs[target];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    buttons.current.get(next.id)?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label={label} className={className}>
        {tabs.map((tab, index) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={active}
              aria-controls={panelId(tab.id)}
              tabIndex={active ? 0 : -1}
              className={tabClassName}
              onClick={() => {
                onChange(tab.id);
              }}
              onKeyDown={(event) => {
                move(event, index);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelId(tab.id)}
            aria-labelledby={tabId(tab.id)}
            hidden={!active}
            className={panelClassName}
          >
            {active || tab.keepMounted ? tab.content : null}
          </div>
        );
      })}
    </>
  );
}
