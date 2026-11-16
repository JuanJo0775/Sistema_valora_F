import { useEffect, useState } from 'react';
import { api, call } from '../../shared/api';

type Status = 'checking' | 'connected' | 'disconnected';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    call(api.GET('/health'))
      .then(() => {
        setStatus('connected');
      })
      .catch(() => {
        setStatus('disconnected');
      });
  }, []);

  if (status === 'checking') return null;
  return <p>{status === 'connected' ? 'API conectada' : 'Sin conexión con la API'}</p>;
}
