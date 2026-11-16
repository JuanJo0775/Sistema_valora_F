import { useEffect, useState } from 'react';

// ADR-010: la consulta necesita conexión. Cuando exista la cola del registro (#26), el aviso dirá
// también que los precios se guardan y se envían al volver la señal.
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
    };
    window.addEventListener('offline', update);
    window.addEventListener('online', update);
    return () => {
      window.removeEventListener('offline', update);
      window.removeEventListener('online', update);
    };
  }, []);

  if (online) return null;
  return (
    <div className="banner warn" role="status">
      Sin conexión. La consulta de precios necesita internet.
    </div>
  );
}
