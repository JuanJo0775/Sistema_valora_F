import { useEffect, useState } from 'react';

// «0:12»: minutos y segundos desde que se abrió el registro.
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

export const secondsSince = (start: Date, end = new Date()) =>
  Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

// #79 y #28 (EC-01): el cronómetro del modo prueba de usabilidad. Se quita al cerrar la #28.
export function Stopwatch({ since }: { since: Date }) {
  const [seconds, setSeconds] = useState(() => secondsSince(since));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(secondsSince(since));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [since]);

  return (
    <p role="timer" aria-label="Cronómetro" className="stopwatch">
      {clock(seconds)}
    </p>
  );
}
