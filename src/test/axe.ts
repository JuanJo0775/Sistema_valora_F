import axe from 'axe-core';

// #28 (WCAG 2.2 AA): las fallas graves o críticas que axe encuentra en la pantalla. El contraste no
// se revisa aquí porque jsdom no pinta (no calcula colores ni tamaños): se revisa a mano con las
// capturas reales (docs/calidad/accesibilidad.md).
export async function seriousViolations(node: Element = document.body): Promise<string[]> {
  const { violations } = await axe.run(node, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(
      ({ id, help, nodes }) =>
        `${id}: ${help} → ${nodes.map(({ target }) => target.join(' ')).join(' | ')}`,
    );
}

// Las fallas de una regla de axe en particular, de cualquier gravedad.
export async function violationsOf(rule: string, node: Element = document.body): Promise<string[]> {
  const { violations } = await axe.run(node, { runOnly: [rule], resultTypes: ['violations'] });
  return violations.flatMap(({ nodes }) => nodes.map(({ target }) => target.join(' ')));
}
