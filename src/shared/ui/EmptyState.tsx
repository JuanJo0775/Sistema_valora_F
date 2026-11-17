import type { ReactNode } from 'react';

export function EmptyState({
  title,
  text,
  action,
  level = 2,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  // 1 cuando el estado vacío es lo único que dice la pantalla (la pantalla necesita su h1).
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="state">
      <Heading>{title}</Heading>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}
