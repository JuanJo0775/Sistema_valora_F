import { fireEvent, screen } from '@testing-library/react';

// Elige una opción de una lista propia (SelectField): abre el campo por su etiqueta y toca la opción.
export async function choose(field: string, option: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${field}`) }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
