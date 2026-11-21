import { useId, useRef, useState } from 'react';
import { OptionList } from '../../shared/ui/OptionList';
import { Overlay } from '../../shared/ui/Overlay';
import { MUNICIPALITIES, MUNICIPALITY_OPTIONS } from './criteria';
import { RadiusControl } from './RadiusControl';
import type { Where } from './useWhere';
import './comparison.css';

const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

// Cómo se lee dónde se busca: «Armenia» o «Cerca de mí · 1,5 km».
export const placeLabel = (where: Where) =>
  where.point
    ? `Cerca de mí · ${KM.format(where.radiusKm)} km`
    : MUNICIPALITIES[where.municipality];

// El «¿Dónde?» de la app, uno solo para el Inicio, el detalle, el mapa y el plan: un botón que dice
// dónde se busca y abre (popover o, en celular, hoja inferior) la elección de «usar mi ubicación»
// —con su radio— o de un municipio. Elegir un municipio se aplica de inmediato y cierra.
export function WherePicker({
  where,
  onLeaveLocation,
  showRadius = true,
}: {
  where: Where;
  // Se avisa cuando se deja la ubicación por un municipio (la pantalla ajusta lo suyo).
  onLeaveLocation?: () => void;
  // El mapa tiene su propia barra de radio junto al mapa.
  showRadius?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useId();
  const place = placeLabel(where);
  const close = () => {
    setOpen(false);
  };
  return (
    <div className="where">
      <button
        ref={trigger}
        type="button"
        className="where-trigger"
        aria-label={`Dónde buscar: ${place}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={() => {
          setOpen((now) => !now);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="where-icon">
          {where.point ? (
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="7.5" />
            </>
          ) : (
            <>
              <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </>
          )}
        </svg>
        <span className="where-text">{place}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="where-chevron">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!open && where.problem && (
        <p role="alert" className="banner warn where-alert">
          {where.problem}
        </p>
      )}
      {open && (
        <Overlay anchor={trigger} title="¿Dónde buscar?" onClose={close}>
          <div id={panel} className="where-panel">
            <section className="where-section">
              <button
                type="button"
                className={where.point ? 'where-near on' : 'where-near'}
                aria-pressed={Boolean(where.point)}
                aria-busy={where.asking}
                aria-describedby={`${panel}-hint`}
                disabled={where.asking}
                onClick={where.locateMe}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="where-icon">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <circle cx="12" cy="12" r="7.5" />
                </svg>
                <span>
                  <strong>
                    {where.asking
                      ? 'Buscando tu ubicación…'
                      : where.point
                        ? 'Cerca de mí'
                        : 'Usar mi ubicación'}
                  </strong>
                  <span id={`${panel}-hint`} className="where-hint" aria-hidden="true">
                    Solo para ver qué tiendas quedan cerca. Tu ubicación no se guarda.
                  </span>
                </span>
              </button>
              {where.problem && (
                <div role="alert" className="banner warn where-problem">
                  <p>{where.problem}</p>
                  <p>
                    Permite la ubicación en el candado de la barra de direcciones o en los ajustes
                    del navegador, y vuelve a tocar «Usar mi ubicación». O elige un municipio.
                  </p>
                </div>
              )}
              {where.point && showRadius && (
                <RadiusControl radiusKm={where.radiusKm} onChange={where.setRadiusKm} />
              )}
            </section>
            <section className="where-section">
              <OptionList
                label="Municipio"
                options={MUNICIPALITY_OPTIONS}
                value={where.point ? null : where.municipality}
                autoFocus
                onSelect={(chosen) => {
                  if (where.point) {
                    where.leaveLocation();
                    onLeaveLocation?.();
                  }
                  where.chooseMunicipality(chosen);
                  close();
                }}
              />
            </section>
            <button type="button" className="btn" onClick={close}>
              Listo
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
