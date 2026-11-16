import { useEffect, useState } from 'react';

export function ApiStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    void fetch('/v1/health').then(() => {
      setConnected(true);
    });
  }, []);

  return connected ? <p>API conectada</p> : null;
}
