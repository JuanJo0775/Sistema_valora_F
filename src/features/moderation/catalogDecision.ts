import { ApiError } from '../../shared/api';

// Fusionar lleva el id del duplicado elegido dentro del valor de la opción.
const MERGE = 'fusionar:';

// Una tienda o un producto propuesto se aprueba, se rechaza o se fusiona solo con uno de los
// duplicados que encontró el servidor (#57).
export const decisionOptions = (
  approveLabel: string,
  duplicates: { id: string; name: string }[],
) => [
  { value: 'aprobar', label: approveLabel },
  ...duplicates.map(({ id, name }) => ({ value: `${MERGE}${id}`, label: `Fusionar con ${name}` })),
  { value: 'rechazar', label: 'Rechazar' },
];

export const decisionBody = (choice: string, note: string) =>
  choice.startsWith(MERGE)
    ? { decision: 'fusionar' as const, note, mergeInto: choice.slice(MERGE.length) }
    : { decision: choice as 'aprobar' | 'rechazar', note };

// Mensajes propios por código de error o, si no hay, por estado HTTP («404»).
export const explainWith =
  (messages: Partial<Record<string, string>>) =>
  (error: unknown): string | null =>
    (error instanceof ApiError && (messages[error.code] ?? messages[String(error.status)])) || null;

export const ALREADY_DECIDED = 'Esta propuesta ya no está pendiente: otro moderador la decidió.';
