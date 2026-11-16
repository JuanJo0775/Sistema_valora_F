import { useMemo, useState } from 'react';
import { askLocation, type Point } from '../../shared/location';
import { SelectField } from '../../shared/ui/SelectField';
import { type Municipality, MUNICIPALITY_OPTIONS } from './criteria';
import { readMunicipality, saveMunicipality } from './lastMunicipality';

const RADII = [0.5, 1, 2, 3];

// #15 y ADR-019: dónde buscar. Por defecto el municipio elegido la última vez (sin pedir permisos,
// EC-08); con la ubicación del momento, a la redonda con un radio. Las dos cosas no se mezclan.
export function useWhere() {
  const [point, setPoint] = useState<Point | null>(null);
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [radiusKm, setRadiusKm] = useState(2);
  const [problem, setProblem] = useState('');
  // Un objeto estable mientras no cambie dónde: se usa como dependencia de las consultas.
  const query = useMemo(
    () => (point ? { ...point, radiusKm } : { municipality }),
    [point, radiusKm, municipality],
  );
  return {
    point,
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
      askLocation()
        .then(setPoint)
        .catch(() => {
          setProblem('Activa la ubicación del navegador para ver las tiendas cercanas.');
        });
    },
    leaveLocation: () => {
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
