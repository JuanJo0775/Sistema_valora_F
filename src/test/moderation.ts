import { fireEvent, screen, within } from '@testing-library/react';

// Un caso de una lista de moderación: el elemento de la lista que lleva ese título.
export const pendingCase = async (name: string) =>
  within((await screen.findByRole('heading', { name })).closest('li') as HTMLElement);

// Elige la decisión, escribe el motivo y la registra.
export const decideCase = (
  card: Awaited<ReturnType<typeof pendingCase>>,
  decision: string,
  note: string,
) => {
  fireEvent.click(card.getByRole('radio', { name: decision }));
  fireEvent.change(card.getByRole('textbox', { name: 'Motivo de la decisión' }), {
    target: { value: note },
  });
  fireEvent.click(card.getByRole('button', { name: 'Registrar decisión' }));
};

// Las opciones de decisión de un caso, en orden.
export const decisionLabels = (card: Awaited<ReturnType<typeof pendingCase>>) =>
  card.getAllByRole('radio').map(({ parentElement }) => parentElement?.textContent);
