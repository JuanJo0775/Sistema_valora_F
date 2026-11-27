import { createContext, useContext } from 'react';
import type { paths } from '../../shared/api/schema';

type Responses<P extends keyof paths> = paths[P] extends { get: { responses: { 200: infer R } } }
  ? R extends { content: { 'application/json': infer Body } }
    ? Body
    : never
  : never;

// Lo que dice el servidor, tal como está en el contrato (openapi.yaml).
export type PendingCounts = Responses<'/moderation/summary'>;
export type MerchantAlert = Responses<'/commerce/alerts'>['items'][number];

// ADR-043: lo que muestra la campana según el rol. `undefined` es «todavía no hay respuesta»: sin
// número, nunca un cero que no es verdad.
export type Avisos =
  // refresh: vuelve a pedir el resumen ya, por ejemplo al decidir un caso.
  | { kind: 'moderador'; counts: PendingCounts | undefined; refresh?: () => void }
  | { kind: 'comercio'; alerts: MerchantAlert[] | undefined }
  | { kind: 'ninguno' };

export const AvisosContext = createContext<Avisos>({ kind: 'ninguno' });

export const useAvisos = () => useContext(AvisosContext);
