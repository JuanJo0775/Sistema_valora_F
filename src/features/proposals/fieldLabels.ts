import { ApiError } from '../../shared/api';

// El servidor valida con los nombres del contrato («packCount: debe ser…»). Aquí se dicen con las
// etiquetas que ve la persona. No cambia el contrato: solo cómo se lee el mensaje.
const LABELS: Record<string, string> = {
  name: 'Nombre',
  brand: 'Marca',
  categoryCode: 'Categoría',
  quantity: 'Cantidad',
  unit: 'Unidad',
  packCount: 'Unidades en el empaque',
  barcode: 'Código de barras',
  type: 'Tipo',
  municipality: 'Municipio',
  address: 'Dirección',
  lat: 'Ubicación',
  lng: 'Ubicación',
  priceCop: 'Precio',
  presentationId: 'Presentación',
  establishmentId: 'Tienda',
  observedAt: 'Cuándo lo viste',
};

const FIELD = new RegExp(String.raw`\b(${Object.keys(LABELS).join('|')})\s*:\s*`, 'g');

// Textos del servidor que dicen mejor otra cosa una vez puesta la etiqueta.
const PHRASES: [RegExp, string][] = [
  [
    /Código de barras: no es un código de barras válido/g,
    'El código de barras no es válido: tiene de 8 a 14 dígitos.',
  ],
];

export function humanizeFields(message: string): string {
  let text = message.replace(FIELD, (_all, field: string) => `${LABELS[field] ?? field}: `);
  for (const [pattern, replacement] of PHRASES) text = text.replace(pattern, replacement);
  return text;
}

// Un error de la API con sus nombres de campo traducidos; cualquier otro error pasa tal cual.
export function humanizeError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const message = humanizeFields(error.message);
  if (message === error.message) return error;
  return new ApiError({
    status: error.status,
    code: error.code,
    message,
    ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    ...(error.availableFrom ? { availableFrom: error.availableFrom } : {}),
  });
}
