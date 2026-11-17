import { useCallback, useEffect, useMemo, useState } from 'react';
import { askLocation, type Point } from '../../shared/location';
import { readStored, writeStored } from '../../shared/storage';
import { SelectField } from '../../shared/ui/SelectField';
import { type Municipality, MUNICIPALITY_OPTIONS } from './criteria';
import { readMunicipality, saveMunicipality } from './lastMunicipality';

const RADII = [0.5, 1, 1.5, 2, 3];

// #73: el teléfono recuerda si se eligió «usar mi ubicación», nunca dónde está la persona (EC-08).
// Al volver, se le pide otra vez la ubicación al navegador.
const MODE = 'valora:donde';
const USE_LOCATION = 'ubicacion';

// #15 y ADR-019: dónde buscar. Por defecto el municipio elegido la última vez (sin pedir permisos,
// EC-08); con la ubicación del momento, a la redonda con un radio. Las dos cosas no se mezclan.
// La comparación usa 2 km por defecto; la canasta del Inicio, 1,5 km (B#128).
export function useWhere(defaultRadiusKm = 2) {
  const [point, setPoint] = useState<Point | null>(null);
  // Mientras se pide la ubicación recordada, todavía no se sabe dónde buscar.
  const [locating, setLocating] = useState(() => readStored(MODE) === USE_LOCATION);
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const [problem, setProblem] = useState('');
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
    setRadiusKm,
    // Para la consulta: la ubicación con su radio, o el municipio.
    query,
    key: point ? `${String(point.lat)},${String(point.lng)}|${String(radiusKm)}` : municipality,
    chooseMunicipality: (chosen: Municipality) => {
      saveMunicipality(chosen);
      setMunicipality(chosen);
    },
    locateMe: () => {
      setProblem('');
      request();
    },
    leaveLocation: () => {
      writeStored(MODE, null);
      setPoint(null);
    },
  };
}

export type Where = ReturnType<typeof useWhere>;

export function WhereChooser({
  where,
  backLabel,
  onLeaveLocation,
}: {
  where: Where;
  backLabel: string;
  onLeaveLocation?: () => void;
}) {
  return (
    <>
      {where.point ? (
        <>
          {/* ADR-019: radio calibrable de 0,5 a 3 km; 2 km por defecto. */}
          <SelectField
            label="Radio"
            value={String(where.radiusKm)}
            options={RADII.map((km) => ({
              value: String(km),
              label: `${String(km).replace('.', ',')} km`,
            }))}
            onChange={(km) => {
              where.setRadiusKm(Number(km));
            }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              where.leaveLocation();
              onLeaveLocation?.();
            }}
          >
            {backLabel}
          </button>
        </>
      ) : (
        <>
          <SelectField
            label="Municipio"
            value={where.municipality}
            options={MUNICIPALITY_OPTIONS}
            onChange={where.chooseMunicipality}
          />
          <button type="button" className="btn ghost" onClick={where.locateMe}>
            Usar mi ubicación
          </button>
        </>
      )}
      {where.problem && (
        <p role="alert" className="banner warn">
          {where.problem}
        </p>
      )}
    </>
  );
}
