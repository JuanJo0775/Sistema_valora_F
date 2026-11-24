import { type ReactNode, useEffect, useRef } from 'react';

export function EmptyState({
  title,
  text,
  action,
  level = 2,
  focus = false,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  // 1 cuando el estado vacío es lo único que dice la pantalla (la pantalla necesita su h1).
  level?: 1 | 2;
  // true cuando este estado aparece como resultado de una acción (por ejemplo «Recibido»): el
  // botón que la pidió ya no existe y el foco pasa al título para que no se pierda (WCAG 2.4.3).
  focus?: boolean;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  return (
    <div className="state">
      <Heading ref={heading} tabIndex={focus ? -1 : undefined}>
        {title}
      </Heading>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}
