import { useCallback, useEffect, useMemo, useState } from 'react';
import { askLocation, type Point } from '../../shared/location';
import { readStored, writeStored } from '../../shared/storage';
import { readRadius, saveRadius } from './radius';
import type { Municipality } from './criteria';
import { readMunicipality, saveMunicipality } from './lastMunicipality';

// #73: el teléfono recuerda si se eligió «usar mi ubicación», nunca dónde está la persona (EC-08).
// Al volver, se le pide otra vez la ubicación al navegador.
const MODE = 'valora:donde';
const USE_LOCATION = 'ubicacion';

// #15 y ADR-019: dónde buscar. Por defecto el municipio elegido la última vez (sin pedir permisos,
// EC-08); con la ubicación del momento, a la redonda con un radio. Las dos cosas no se mezclan.
// El radio es el mismo en todas las pantallas y se recuerda (radius.ts).
export function useWhere() {
  const [point, setPoint] = useState<Point | null>(null);
  // Mientras se pide la ubicación recordada, todavía no se sabe dónde buscar.
  const [locating, setLocating] = useState(() => readStored(MODE) === USE_LOCATION);
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [radiusKm, setRadius] = useState(readRadius);
  const [problem, setProblem] = useState('');
  // Mientras el navegador responde a una petición de ubicación (la persona decide en el aviso).
  const [asking, setAsking] = useState(false);
  // Un objeto estable mientras no cambie dónde: se usa como dependencia de las consultas.
  const query = useMemo(
    () => (point ? { ...point, radiusKm } : { municipality }),
    [point, radiusKm, municipality],
  );
  // Solo lo que llega después de preguntar: el efecto de abrir no cambia el estado de inmediato.
  const request = useCallback(() => {
    askLocation()
      .then((found) => {
        writeStored(MODE, USE_LOCATION);
        setPoint(found);
      })
      .catch(() => {
        writeStored(MODE, null);
        setProblem('Activa la ubicación del navegador para ver las tiendas cercanas.');
      })
      .finally(() => {
        setAsking(false);
        setLocating(false);
      });
  }, []);

  // Solo al abrir: después, la ubicación se pide con «Usar mi ubicación».
  useEffect(() => {
    if (readStored(MODE) === USE_LOCATION) request();
  }, [request]);

  return {
    point,
    // Falso mientras se pide la ubicación recordada: las consultas esperan.
    ready: !locating,
    municipality,
    radiusKm,
    problem,
    asking: asking || locating,
    setRadiusKm: (km: number) => {
      saveRadius(km);
      setRadius(km);
    },
    // Para la consulta: la ubicación con su radio, o el municipio.
    query,
    key: point ? `${String(point.lat)},${String(point.lng)}|${String(radiusKm)}` : municipality,
    chooseMunicipality: (chosen: Municipality) => {
      saveMunicipality(chosen);
      setMunicipality(chosen);
    },
    locateMe: () => {
      setProblem('');
      setAsking(true);
      request();
    },
    leaveLocation: () => {
      writeStored(MODE, null);
      setPoint(null);
    },
  };
}

export type Where = ReturnType<typeof useWhere>;
