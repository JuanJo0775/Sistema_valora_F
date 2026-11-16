import { type SyntheticEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorState } from '../../shared/ui/ErrorState';
import { SelectField } from '../../shared/ui/SelectField';
import { Field } from '../auth/Field';
import './proposals.css';

type Category = components['schemas']['Category'];
type Unit = components['schemas']['Unit'];

const UNITS: { value: Unit; label: string }[] = [
  { value: 'g', label: 'gramos (g)' },
  { value: 'kg', label: 'kilos (kg)' },
  { value: 'ml', label: 'mililitros (ml)' },
  { value: 'l', label: 'litros (l)' },
  { value: 'und', label: 'unidades' },
];

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
  const [problem, setProblem] = useState('');
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
    const found = !categoryCode
      ? 'Elige la categoría.'
      : !(amount > 0)
        ? 'Escribe la cantidad, por ejemplo 500.'
        : '';
    setProblem(found);
    if (found) return;
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
        setError(failure);
      });
  };

  if (received) {
    return (
      <EmptyState
        title="Recibido"
        text="Aparecerá en la búsqueda cuando un moderador lo apruebe."
      />
    );
  }
  return (
    <form className="form proposal" onSubmit={submit} noValidate>
      <h1>Proponer un producto</h1>
      <Field label="Nombre del producto" value={name} onValue={setName} />
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
      <div className="pair">
        <Field label="Cantidad" inputMode="decimal" value={quantity} onValue={setQuantity} />
        <SelectField label="Unidad" value={unit} options={UNITS} onChange={setUnit} />
      </div>
      <Field
        label="Unidades en el empaque"
        inputMode="numeric"
        value={packCount}
        onValue={setPackCount}
      />
      <Field
        label="Código de barras (opcional)"
        inputMode="numeric"
        value={barcode}
        onValue={setBarcode}
        required={false}
      />
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      <button type="submit" className="btn">
        Enviar propuesta
      </button>
    </form>
  );
}
