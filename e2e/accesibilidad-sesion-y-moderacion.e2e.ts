import { expect, type Page, test } from '@playwright/test';
import { expectNoSeriousAxe } from './support/layout';

// #28 (WCAG 2.2 AA): axe en un navegador de verdad, que sí mide el contraste pintado (jsdom no puede),
// en los flujos de sesión y de moderación, en tema claro y oscuro, en celular y en computador.
// Sin backend: todo /v1 es falso (page.route). Lo demás (búsqueda, comparación y registro de un
// precio) ya lo revisan `pulido-pantallas` y `sin-scroll-anidado`.

type Role = 'reportante' | 'moderador' | null;

async function fakeServer(page: Page, role: Role) {
  await page.route('**/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/auth/session')) {
      if (role === null) {
        return route.fulfill({
          status: 401,
          json: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
        });
      }
      return route.fulfill({
        json: {
          role,
          csrfToken: 'token-e2e',
          emailVerified: true,
          emailVerificationRequired: true,
          hasPassword: true,
          displayName: 'Persona de prueba',
        },
      });
    }
    // Con casos pendientes, para que las pestañas y la campana muestren sus números.
    if (pathname.endsWith('/moderation/summary')) {
      return route.fulfill({ json: { precios: 2, tiendas: 1, productos: 3, comercios: 1 } });
    }
    if (pathname.includes('/moderation/') || pathname.endsWith('/categories')) {
      return route.fulfill({ json: { items: [] } });
    }
    // Servidor sin avisos configurados: la activación de avisos no se muestra.
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'No existe.' } });
  });
}

const SCREENS: { name: string; path: string; role: Role }[] = [
  { name: 'iniciar sesión', path: '/entrar', role: null },
  { name: 'crear cuenta', path: '/crear-cuenta', role: null },
  { name: 'Yo con sesión', path: '/yo', role: 'reportante' },
  { name: 'Ajustes del moderador', path: '/yo/ajustes', role: 'moderador' },
  { name: 'moderación · Precios', path: '/moderacion?vista=precios', role: 'moderador' },
  { name: 'moderación · Tiendas', path: '/moderacion?vista=tiendas', role: 'moderador' },
  { name: 'moderación · Productos', path: '/moderacion?vista=productos', role: 'moderador' },
  { name: 'moderación · Comercios', path: '/moderacion?vista=comercios', role: 'moderador' },
  { name: 'moderación · Roles', path: '/moderacion?vista=roles', role: 'moderador' },
];

const SIZES = [
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'pc-1280', width: 1280, height: 800 },
];

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    for (const screen of SCREENS) {
      test(`${screen.name}: sin fallas graves de axe, tema ${scheme}, ${size.name}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: size.width, height: size.height });
        await fakeServer(page, screen.role);
        await page.goto(screen.path);

        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        // Que ya no haya respuestas pendientes ni animaciones a medias: axe mide colores asentados.
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(400);

        await expectNoSeriousAxe(page);
      });
    }
  }
}
