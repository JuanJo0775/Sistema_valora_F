import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import {
  expectNoSeriousAxe,
  nestedScrollers,
  noOverflow,
  SEVEN_SIZES,
  smallTargets,
} from './support/layout';

// «Yo» › Ajustes › Cuenta › Nombre: abrir, cambiar, verlo en «Yo» sin recargar y el error 400, en los
// siete tamaños de la regresión. Sin backend: todo /v1 es falso (page.route). Con NOMBRE_EVIDENCIA se
// guardan capturas (escala 1) en esa carpeta, que debe quedar fuera del repo.
const EVIDENCIA = process.env['NOMBRE_EVIDENCIA'];

// El servidor falso: la sesión recuerda el nombre que se guardó y cada PATCH queda anotado.
async function fakeServer(page: Page, name: string | null) {
  const state = { name, sessions: 0, patches: [] as { body: unknown; csrf: string | null }[] };
  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/auth/session')) {
      state.sessions += 1;
      return route.fulfill({
        json: {
          role: 'reportante',
          csrfToken: 'token-e2e',
          emailVerified: true,
          emailVerificationRequired: true,
          hasPassword: true,
          ...(state.name ? { displayName: state.name } : {}),
        },
      });
    }
    if (pathname.endsWith('/me/profile') && request.method() === 'PATCH') {
      const body = request.postDataJSON() as { displayName: string };
      state.patches.push({ body, csrf: request.headers()['x-csrf-token'] ?? null });
      if (body.displayName === 'Invalido') {
        return route.fulfill({
          status: 400,
          json: {
            code: 'VALIDATION_ERROR',
            message: 'displayName: debe tener de 2 a 40 letras, sin números, correos ni símbolos',
          },
        });
      }
      state.name = body.displayName;
      return route.fulfill({ json: { displayName: body.displayName } });
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'No existe.' } });
  });
  return state;
}

const shot = (page: Page, file: string) =>
  EVIDENCIA ? page.screenshot({ path: join(EVIDENCIA, file), fullPage: true }) : Promise.resolve();

async function expectClean(page: Page) {
  expect(await noOverflow(page), 'sin desborde horizontal').toBe(true);
  expect(await nestedScrollers(page), 'sin scroll anidado').toEqual([]);
  expect(await smallTargets(page, 'main'), 'objetivos de 24 px o más').toEqual([]);
  await expectNoSeriousAxe(page);
}

for (const size of SEVEN_SIZES) {
  test(`cambiar el nombre en Ajustes a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const server = await fakeServer(page, 'Sara');
    await page.goto('/yo/ajustes');

    // La fila: nombre actual y un botón de 44 px en el celular.
    await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const change = page.getByRole('button', { name: 'Cambiar nombre' });
    await expect(change).toBeVisible();
    await expect(page.getByText('Sara', { exact: true })).toBeVisible();
    await expectClean(page);
    await shot(page, `fila-${size.name}.png`);

    // Abre en el lugar: foco en el campo precargado, etiqueta visible, sin ventana modal.
    await change.click();
    const field = page.getByLabel('Tu nombre');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Sara');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (size.width <= 480) {
      for (const target of [
        field,
        page.getByRole('button', { name: 'Guardar' }),
        page.getByRole('button', { name: 'Cancelar' }),
      ]) {
        expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    }
    // El orden del foco es el de la pantalla: campo, Guardar, Cancelar.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    // Error 400 del servidor: el mensaje queda junto al campo, que sigue abierto y marcado.
    await field.fill('Invalido');
    await field.press('Enter');
    const message = page.getByText('Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.');
    await expect(message).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    await expectClean(page);
    await shot(page, `error-${size.name}.png`);

    // Escape cancela y devuelve el foco al botón; el nombre no cambió.
    await field.press('Escape');
    await expect(change).toBeFocused();
    await expect(page.getByText('Sara', { exact: true })).toBeVisible();

    // Cambiarlo: Enter guarda, el aviso se anuncia en la región de estado.
    await change.click();
    await field.fill('Sara Lucía');
    await field.press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'Listo: tu nombre ahora es Sara Lucía' }),
    ).toBeVisible();
    await expect(change).toBeFocused();
    expect(server.patches.map(({ body }) => body)).toEqual([
      { displayName: 'Invalido' },
      { displayName: 'Sara Lucía' },
    ]);
    expect(server.patches.every(({ csrf }) => csrf === 'token-e2e')).toBe(true);
    await expectClean(page);
    await shot(page, `exito-${size.name}.png`);

    // «Yo» saluda con el nombre nuevo sin recargar (la sesión no se vuelve a pedir).
    const sessions = server.sessions;
    await page.getByRole('link', { name: 'Yo', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hola, Sara Lucía' })).toBeVisible();
    expect(server.sessions).toBe(sessions);
    await expectClean(page);
  });
}

test('una cuenta sin nombre lo agrega desde Ajustes', async ({ page }) => {
  const server = await fakeServer(page, null);
  await page.goto('/yo/ajustes');
  await expect(page.getByText('Aún no tienes un nombre.')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar nombre' }).click();
  await expect(page.getByLabel('Tu nombre')).toHaveValue('');
  await page.getByLabel('Tu nombre').fill('Mateo');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Listo: tu nombre ahora es Mateo.')).toBeVisible();
  expect(server.patches).toHaveLength(1);
});
