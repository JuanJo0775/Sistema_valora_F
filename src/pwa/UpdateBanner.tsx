import { useRegisterSW } from 'virtual:pwa-register/react';

// #26: la app no se actualiza a escondidas. Si hay una versión nueva, lo dice y se instala cuando
// la persona lo pide (por ejemplo, después de terminar un reporte).
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className="banner warn">
      Hay una versión nueva de Valora{' '}
      <button type="button" className="btn ghost" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  );
}
