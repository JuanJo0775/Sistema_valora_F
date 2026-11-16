import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, call } from '../../shared/api';
import { askLocation, type Point } from '../../shared/location';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Loading } from '../../shared/ui/Loading';
import { SelectField } from '../../shared/ui/SelectField';
import { formatPresentation } from '../catalog/presentation';
import { describeCriteria, type Municipality, MUNICIPALITIES } from './criteria';
import { readMunicipality, saveMunicipality } from './lastMunicipality';
import { Offer } from './Offer';
import './comparison.css';

type Product = components['schemas']['Product'];
type Comparison = components['schemas']['Comparison'];
type Sort = Comparison['criteria']['sort'];
const RADII = [0.5, 1, 2, 3];

const MUNICIPALITY_OPTIONS = (Object.keys(MUNICIPALITIES) as Municipality[]).map((value) => ({
  value,
  label: MUNICIPALITIES[value],
}));

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'unit_price', label: 'Precio por unidad' },
  { value: 'recent', label: 'Más recientes' },
  { value: 'distance', label: 'Distancia' },
];

// P7 (neutralidad, EC-06): el orden lo decide el backend con el criterio declarado; la pantalla
// no reordena ni destaca a nadie más que a lo que el backend marca.
export function ComparePrices() {
  const { productId = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [productError, setProductError] = useState<unknown>(null);
  const [sort, setSort] = useState<Sort>('unit_price');
  // Por defecto Armenia, sin pedir permisos; con la ubicación, las tiendas cercanas (EC-08: la
  // ubicación solo va en la consulta y no se guarda).
  const [point, setPoint] = useState<Point | null>(null);
  const [municipality, setMunicipality] = useState<Municipality>(readMunicipality);
  const [radiusKm, setRadiusKm] = useState(2);
  const [locationProblem, setLocationProblem] = useState('');
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  // Cada respuesta guarda la consulta que la pidió: una lenta no pisa a una más nueva.
  const [outcome, setOutcome] = useState<
    { key: string; comparison: Comparison } | { key: string; error: unknown } | null
  >(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${String(attempt)}|${productId}|${sort}|${String(onlyCurrent)}|${point ? `${String(point.lat)},${String(point.lng)}` : municipality}|${String(radiusKm)}`;

  useEffect(() => {
    call(api.GET('/products/{productId}', { params: { path: { productId } } }))
      .then(setProduct)
      .catch((error: unknown) => {
        setProductError(error);
      });
  }, [productId, attempt]);

  useEffect(() => {
    let current = true;
    call(
      api.GET('/products/{productId}/comparison', {
        params: {
          path: { productId },
          query: { ...(point ? { ...point, radiusKm } : { municipality }), sort, onlyCurrent },
        },
      }),
    )
      .then((comparison) => {
        if (current) setOutcome({ key, comparison });
      })
      .catch((error: unknown) => {
        if (current) setOutcome({ key, error });
      });
    return () => {
      current = false;
    };
  }, [productId, sort, point, municipality, radiusKm, onlyCurrent, key]);

  const retry = () => {
    setProductError(null);
    setAttempt((current) => current + 1);
  };
  if (productError !== null) return <ErrorState error={productError} onRetry={retry} />;
  if (!product) return <Loading />;
  const result = outcome?.key === key ? outcome : null;
  const sizeOf = (presentationId: string) => {
    const presentation = product.presentations.find(({ id }) => id === presentationId);
    return presentation ? formatPresentation(presentation) : '';
  };
  return (
    <section className="compare">
      <h1>{product.name}</h1>
      <fieldset role="radiogroup" className="choices">
        <legend>Ordenar por</legend>
        {SORT_OPTIONS.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="sort"
              value={option.value}
              checked={sort === option.value}
              // Sin la ubicación no hay distancia: el backend responde 400 a sort=distance.
              disabled={option.value === 'distance' && !point}
              onChange={() => {
                setSort(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {/* #15: por defecto Armenia (las tiendas de la semilla), sin pedir la ubicación (EC-08). Con la
          ubicación, las tiendas a la redonda; las dos cosas no se mezclan. */}
      {point ? (
        <>
          {/* ADR-019: radio calibrable de 0,5 a 3 km; 2 km por defecto. */}
          <SelectField
            label="Radio"
            value={String(radiusKm)}
            options={RADII.map((km) => ({
              value: String(km),
              label: `${String(km).replace('.', ',')} km`,
            }))}
            onChange={(km) => {
              setRadiusKm(Number(km));
            }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setPoint(null);
              // Sin ubicación no hay distancia: el backend responde 400 a sort=distance.
              if (sort === 'distance') setSort('unit_price');
            }}
          >
            Comparar por municipio
          </button>
        </>
      ) : (
        <>
          <SelectField
            label="Municipio"
            value={municipality}
            options={MUNICIPALITY_OPTIONS}
            onChange={(chosen) => {
              saveMunicipality(chosen);
              setMunicipality(chosen);
            }}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setLocationProblem('');
              askLocation()
                .then(setPoint)
                .catch(() => {
                  setLocationProblem(
                    'Activa la ubicación del navegador para ver las tiendas cercanas.',
                  );
                });
            }}
          >
            Usar mi ubicación
          </button>
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={onlyCurrent}
          onChange={(event) => {
            setOnlyCurrent(event.target.checked);
          }}
        />
        Solo precios vigentes
      </label>
      {locationProblem && (
        <p role="alert" className="banner warn">
          {locationProblem}
        </p>
      )}
      {!result && <Loading />}
      {result && 'error' in result && <ErrorState error={result.error} onRetry={retry} />}
      {result && 'comparison' in result && (
        <Results
          comparison={result.comparison}
          sizeOf={sizeOf}
          register={`/registrar?producto=${productId}`}
        />
      )}
    </section>
  );
}

const competes = (offer: Comparison['results'][number]) =>
  offer.freshness !== 'desactualizado' && offer.reliability !== 'en_revision';

function Results({
  comparison,
  sizeOf,
  register,
}: {
  comparison: Comparison;
  sizeOf: (presentationId: string) => string;
  register: string;
}) {
  const { criteria, results } = comparison;
  if (results.length === 0) {
    const where = criteria.municipality
      ? `en ${MUNICIPALITIES[criteria.municipality]}`
      : 'cerca de ti';
    return (
      <EmptyState
        title={`Todavía nadie ha reportado este producto ${where}`}
        action={
          <Link to={register} className="btn">
            Registrar un precio
          </Link>
        }
      />
    );
  }
  const competing = results.filter(competes);
  const others = results.filter((offer) => !competes(offer));
  return (
    <>
      <p className="muted">{describeCriteria(criteria)}</p>
      <ul className="offers">
        {competing.map((offer) => (
          <Offer key={offer.reportId} offer={offer} size={sizeOf(offer.presentationId)} />
        ))}
      </ul>
      {/* El backend los pone al final y no compiten en el orden (RF-010, RF-012). */}
      {others.length > 0 && (
        <>
          <h2>Precios viejos o en revisión</h2>
          <ul className="offers">
            {others.map((offer) => (
              <Offer key={offer.reportId} offer={offer} size={sizeOf(offer.presentationId)} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
