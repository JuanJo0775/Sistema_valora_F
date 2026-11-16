import type { ReactNode } from 'react';
import type { Role } from './session';

export function RequireRole({ children }: { role: Role; children: ReactNode }) {
  return children;
}
