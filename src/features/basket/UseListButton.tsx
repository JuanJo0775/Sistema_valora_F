import { useRef, useState } from 'react';
import { Overlay } from '../../shared/ui/Overlay';
import { planName, type SavedPlan } from '../plan/savedPlan';

export type UseMode = 'replace' | 'add';

// «Usar esta lista»: si ya hay productos en «Mi lista» pregunta si se reemplaza o se agrega; si no hay
// ninguno, la carga sin preguntar. Lo comparten la tarjeta de «Guardadas» y la página de la lista.
export function UseListButton({
  plan,
  ask,
  onUse,
}: {
  plan: SavedPlan;
  // Hay productos hoy en «Mi lista».
  ask: boolean;
  onUse: (plan: SavedPlan, mode: UseMode) => void;
}) {
  const [asking, setAsking] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const name = planName(plan);
  const use = (how: UseMode) => {
    setAsking(false);
    onUse(plan, how);
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn"
        aria-label={`Usar esta lista: ${name}`}
        aria-haspopup={ask ? 'dialog' : undefined}
        onClick={() => {
          if (ask) setAsking(true);
          else use('replace');
        }}
      >
        Usar esta lista
      </button>
      {asking && (
        <Overlay
          anchor={button}
          title={`Usar «${name}»`}
          onClose={() => {
            setAsking(false);
          }}
        >
          <div className="saved-ask">
            <p>Ya tienes productos en tu lista. ¿Qué hacemos con ellos?</p>
            <button
              type="button"
              className="btn"
              data-autofocus
              onClick={() => {
                use('replace');
              }}
            >
              Reemplazar mi lista
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                use('add');
              }}
            >
              Agregar a mi lista
            </button>
          </div>
        </Overlay>
      )}
    </>
  );
}
