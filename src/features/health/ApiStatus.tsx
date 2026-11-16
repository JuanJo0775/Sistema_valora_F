import { useEffect, useState } from 'react';

type Status = 'checking' | 'connected' | 'disconnected';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    fetch('/v1/health')
      .then((response) => {
        setStatus(response.ok ? 'connected' : 'disconnected');
      })
      .catch(() => {
        setStatus('disconnected');
      });
  }, []);

  if (status === 'checking') return null;
  return <p>{status === 'connected' ? 'API conectada' : 'Sin conexión con la API'}</p>;
}
