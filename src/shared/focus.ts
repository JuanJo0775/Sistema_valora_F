// Cuando una acción hace desaparecer o deshabilita el botón que se acaba de usar, el navegador deja el
// foco en <body> y quien navega con teclado o con lector de pantalla pierde su lugar (WCAG 2.4.3).
// Esta función lleva el foco al elemento indicado solo si se perdió; si ya está en otro elemento
// (por ejemplo, un campo al que se movió a propósito), no lo toca.
export function restoreFocus(target: HTMLElement | null) {
  const current = document.activeElement;
  if (target && (!current || current === document.body)) target.focus();
}
