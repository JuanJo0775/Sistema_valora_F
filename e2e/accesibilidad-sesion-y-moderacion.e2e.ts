import { expect, type Page, test } from '@playwright/test';
import { expectNoSeriousAxe } from './support/layout';

// #28 (WCAG 2.2 AA): axe en un navegador de verdad, que sí mide el contraste pintado (jsdom no puede),
// en los flujos de sesión, de comercio y de moderación, en tema claro y oscuro, en celular y en
// computador; más la estructura y el teclado de cada pantalla. Sin backend: todo /v1 es falso
// (page.route). Lo demás (búsqueda, comparación y registro de un precio) ya lo revisan
// `pulido-pantallas` y `sin-scroll-anidado`.

type Role = 'reportante' | 'comercio' | 'moderador' | null;

const PRICE = {
  presentationId: 'p1',
  establishmentId: 's1',
  priceCop: 2200,
  freshness: 'por_confirmar',
  confirmedAt: '2026-11-12T12:00:00Z',
};

const PROMOTION = {
  id: 'promo-1',
  establishmentId: 's1',
  presentationId: 'p1',
  productName: 'Arroz',
  presentationLabel: '500 g',
  type: 'descuento_porcentual',
  percent: 10,
  validFrom: '2026-11-22',
  validUntil: '2026-12-25',
  createdAt: '2026-11-22T12:00:00Z',
  status: 'activa',
  conditions: { whileStocksLast: false, paymentMethod: 'cualquiera' },
  officialPriceCop: 2200,
  promotedPriceCop: 1980,
};

async function fakeServer(page: Page, role: Role) {
  await page.route('**/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const is = (suffix: string) => pathname.endsWith(suffix);
    if (is('/auth/session')) {
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
    if (is('/moderation/summary')) {
      return route.fulfill({ json: { precios: 2, tiendas: 1, productos: 3, comercios: 1 } });
    }
    if (pathname.includes('/moderation/') || is('/categories')) {
      return route.fulfill({ json: { items: [] } });
    }
    // El portal del comercio: una tienda verificada con un precio y una promoción.
    if (is('/commerce/me') && role === 'comercio') {
      return route.fulfill({
        json: {
          status: 'verificado',
          establishment: { id: 's1', name: 'La Rosa' },
          responsibleName: 'Rosa Gómez',
          informal: false,
          verifiedAt: '2026-11-20T12:00:00Z',
          canDeleteEstablishment: true,
        },
      });
    }
    if (is('/commerce/prices')) return route.fulfill({ json: { items: [PRICE], inReview: [] } });
    if (is('/commerce/promotions')) return route.fulfill({ json: { items: [PROMOTION] } });
    if (is('/commerce/alerts')) return route.fulfill({ json: { items: [] } });
    if (is('/establishments/s1/prices')) {
      return route.fulfill({
        json: {
          establishment: {
            id: 's1',
            name: 'La Rosa',
            type: 'barrio',
            address: 'Calle 1 # 2-3',
            lat: 4.535,
            lng: -75.6811,
            municipality: 'armenia',
            phone: '3001234567',
          },
          prices: [{ presentationId: 'p1', productName: 'Arroz · 500 g' }],
        },
      });
    }
    if (is('/establishments')) return route.fulfill({ json: { items: [] } });
    // Servidor sin avisos configurados: la activación de avisos no se muestra.
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'No existe.' } });
  });
}

interface Screen {
  name: string;
  path: string;
  role: Role;
  // Pestaña que se abre dentro de la pantalla (el portal del comercio).
  tab?: string;
}

const SCREENS: Screen[] = [
  { name: 'iniciar sesión', path: '/entrar', role: null },
  { name: 'crear cuenta', path: '/crear-cuenta', role: null },
  { name: 'Yo con sesión', path: '/yo', role: 'reportante' },
  { name: 'Yo del comercio', path: '/yo', role: 'comercio' },
  { name: 'Ajustes del moderador', path: '/yo/ajustes', role: 'moderador' },
  { name: 'Ajustes del comercio', path: '/yo/ajustes', role: 'comercio' },
  { name: 'registrar mi tienda', path: '/comercios/registro', role: 'reportante' },
  { name: 'comercio · Precios', path: '/comercios', role: 'comercio', tab: 'Precios' },
  { name: 'comercio · Carga masiva', path: '/comercios', role: 'comercio', tab: 'Carga masiva' },
  { name: 'comercio · Promociones', path: '/comercios', role: 'comercio', tab: 'Promociones' },
  { name: 'comercio · Mi tienda', path: '/comercios', role: 'comercio', tab: 'Mi tienda' },
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

async function open(page: Page, screen: Screen) {
  await fakeServer(page, screen.role);
  await page.goto(screen.path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  if (screen.tab) {
    await page.getByRole('tab', { name: screen.tab }).click();
    await expect(page.getByRole('tab', { name: screen.tab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
  // Que ya no haya respuestas pendientes ni animaciones a medias: axe mide colores asentados.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const size of SIZES) {
    for (const screen of SCREENS) {
      test(`${screen.name}: sin fallas graves de axe, tema ${scheme}, ${size.name}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, screen);

        await expectNoSeriousAxe(page);
      });
    }
  }
}

// Cómo se ve el foco en lo que acaba de recibirlo: contorno de 2 px o más, o sombra, en el propio
// elemento o en su ficha (casillas y radios), o en el pulgar del deslizador, que es donde lo pinta.
// El foco de un deslizador se pinta en su pulgar (`::-webkit-slider-thumb`), que getComputedStyle no
// expone: ahí se comparan dos capturas del control, con y sin foco.
interface Stop {
  name: string;
  visible: boolean;
  // Tab salió de la página: no hay más paradas.
  end?: boolean;
}

const focusRing = (): Stop => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return { name: '(fin de la página)', visible: true, end: true };
  const marked = (style: CSSStyleDeclaration) =>
    (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) ||
    style.boxShadow !== 'none';
  const places: CSSStyleDeclaration[] = [getComputedStyle(el)];
  const label = el.closest('label');
  if (label) places.push(getComputedStyle(label));
  const name = (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40);
  const kind = el.getAttribute('type') ?? el.getAttribute('role') ?? '';
  return {
    name: `${el.tagName.toLowerCase()}${kind ? `[${kind}]` : ''} «${name}»`,
    visible: places.some(marked),
  };
};

async function sliderShowsFocus(page: Page) {
  // Hay un solo deslizador por pantalla. El localizador no usa :focus porque después se le quita.
  const slider = page.locator('input[type="range"]').first();
  const box = await slider.boundingBox();
  if (!box) return false;
  // Un margen alrededor: el pulgar puede sobresalir de la caja del control.
  const clip = {
    x: Math.max(0, box.x - 8),
    y: Math.max(0, box.y - 8),
    width: box.width + 16,
    height: box.height + 16,
  };
  const focused = await page.screenshot({ clip, animations: 'disabled' });
  await slider.evaluate((el) => {
    el.blur();
  });
  const plain = await page.screenshot({ clip, animations: 'disabled' });
  await slider.focus();
  return !focused.equals(plain);
}

// Estructura y teclado (AC1, AC3 y AC11 del plan de pruebas manual): idioma, un solo h1, «Saltar al
// contenido» como primer Tab y contorno de foco visible en las primeras paradas. En las pantallas con
// pestañas, abrir la pestaña ya movió el foco: ahí se enfoca el enlace a mano y se revisa lo demás.
for (const screen of SCREENS) {
  test(`${screen.name}: idioma, un h1, saltar al contenido y foco visible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, screen);

    expect(await page.locator('html').getAttribute('lang')).toBe('es-CO');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    if (screen.tab) {
      await page.locator('.skip-link').focus();
    } else {
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.textContent.trim());
      expect(first, 'el primer Tab').toBe('Saltar al contenido');
    }
    await page.keyboard.press('Enter');
    const landed = await page.evaluate(() => document.activeElement?.id);
    expect(landed, 'Enter lleva el foco al contenido').toBe('contenido');
    expect(new URL(page.url()).hash, 'sin cambiar la dirección').toBe('');

    const stops: Stop[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(focusRing);
      if (stop.end) break;
      if (!stop.visible && stop.name.startsWith('input[range]')) {
        stop.visible = await sliderShowsFocus(page);
      }
      stops.push(stop);
    }
    expect(stops.length, 'paradas de Tab revisadas').toBeGreaterThan(0);
    expect(
      stops.filter(({ visible }) => !visible).map(({ name }) => name),
      'paradas de Tab sin contorno de foco visible',
    ).toEqual([]);
  });
}
