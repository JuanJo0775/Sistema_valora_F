// role="status": los lectores de pantalla lo leen sin mover el foco (WCAG 2.2, 4.1.3).
export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <p className="state muted" role="status">
      {text}
    </p>
  );
}
