import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SelectField } from '../../shared/ui/SelectField';
import { Field } from '../auth/Field';
import { useFocusFirstInvalid } from '../auth/formErrors';
import { humanizeError } from './fieldLabels';
import './proposals.css';
import { BackLink } from '../../shared/ui/BackLink';

type Category = components['schemas']['Category'];
type Unit = components['schemas']['Unit'];

const UNITS: { value: Unit; label: string }[] = [
  { value: 'g', label: 'gramos (g)' },
  { value: 'kg', label: 'kilos (kg)' },
  { value: 'ml', label: 'mililitros (ml)' },
  { value: 'l', label: 'litros (l)' },
  { value: 'und', label: 'unidades' },
];

interface Problems {
  name?: string;
  category?: string;
  quantity?: string;
  packCount?: string;
  barcode?: string;
}

// RF-003: un reportante propone un producto que no está. Queda pendiente y no aparece en la
// búsqueda hasta que un moderador lo aprueba (RN3).
export function ProposeProduct() {
  const [params] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(params.get('nombre') ?? '');
  const [brand, setBrand] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [packCount, setPackCount] = useState('1');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);
  const [received, setReceived] = useState(false);

  useEffect(() => {
    void call(api.GET('/categories')).then(({ items }) => {
      setCategories(items);
    });
  }, []);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const amount = Number(quantity.replace(',', '.'));
    // Lo que exige el contrato, dicho antes de enviar: el servidor vuelve a validarlo.
    const found: Problems = {};
    if (name.trim().length < 2) found.name = 'Escribe el nombre del producto.';
    if (!categoryCode) found.category = 'Elige la categoría.';
    if (!(amount > 0)) found.quantity = 'Escribe la cantidad, por ejemplo 500.';
    if (!/^\d+$/.test(packCount.trim()) || Number(packCount) < 1) {
      found.packCount = 'Escribe cuántas unidades trae el empaque: un número entero desde 1.';
    }
    if (barcode.trim() && !/^\d{8,14}$/.test(barcode.trim())) {
      found.barcode = 'El código de barras tiene de 8 a 14 dígitos, sin espacios.';
    }
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    call(
      api.POST('/product-requests', {
        body: {
          name: name.trim(),
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          categoryCode,
          quantity: amount,
          unit,
          packCount: Number(packCount),
          ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
        },
      }),
    )
      .then(() => {
        setReceived(true);
      })
      .catch((failure: unknown) => {
        setError(humanizeError(failure));
      });
  };

  if (received) {
    return (
      <EmptyState
        title="Recibido"
        text="Aparecerá en la búsqueda cuando un moderador lo apruebe."
        action={
          <div className="actions">
            <Link to="/mis-aportes" className="btn">
              Ver mis aportes
            </Link>
            <Link to="/" className="btn ghost">
              Volver al inicio
            </Link>
          </div>
        }
      />
    );
  }
  return (
    <form className="form proposal" onSubmit={submit} noValidate ref={formRef}>
      <BackLink fallback="/" />
      <h1>Proponer un producto</h1>
      <Field label="Nombre del producto" value={name} onValue={setName} error={problems.name} />
      <Field label="Marca (opcional)" value={brand} onValue={setBrand} required={false} />
      <SelectField
        label="Categoría"
        value={categoryCode}
        options={[
          { value: '', label: 'Elige la categoría' },
          ...categories.map(({ code, name: label }) => ({ value: code, label })),
        ]}
        onChange={setCategoryCode}
      />
      {problems.category && (
        <p role="alert" className="field-error">
          {problems.category}
        </p>
      )}
      <div className="pair">
        <Field
          label="Cantidad"
          inputMode="decimal"
          value={quantity}
          onValue={setQuantity}
          error={problems.quantity}
        />
        <SelectField label="Unidad" value={unit} options={UNITS} onChange={setUnit} />
      </div>
      <Field
        label="Unidades en el empaque"
        inputMode="numeric"
        value={packCount}
        onValue={setPackCount}
        error={problems.packCount}
      />
      <Field
        label="Código de barras (opcional)"
        inputMode="numeric"
        value={barcode}
        onValue={setBarcode}
        error={problems.barcode}
        required={false}
      />
      {error !== null && <ErrorState error={error} />}
      <button type="submit" className="btn">
        Enviar propuesta
      </button>
    </form>
  );
}
