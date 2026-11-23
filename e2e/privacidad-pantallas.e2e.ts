import { expect, test } from '@playwright/test';

// La política de privacidad (/privacidad) se lee en todos los tamaños sin desplazarse hacia los lados:
// ni la página ni la tabla de datos tienen scroll propio (a 360 px la tabla tenía 3 px de scroll
// horizontal escondido) y las laptops de 14 y 16 pulgadas (1366×768, 1536×864, 1728×1117) se ven igual.
const SIZES = [
  { name: 'celular-320', width: 320, height: 640 },
  { name: 'celular-360', width: 360, height: 740 },
  { name: 'celular-390', width: 390, height: 844 },
  { name: 'tableta-768', width: 768, height: 1024 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1536', width: 1536, height: 864 },
  { name: 'laptop-1728', width: 1728, height: 1117 },
];

for (const size of SIZES) {
  test(`/privacidad sin scroll interno a ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const scrolling = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const style = getComputedStyle(el);
        const x = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
        const y = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
        if (x || y) found.push(`${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`);
      }
      return found;
    });
    expect(scrolling).toEqual([]);
    const pageOverflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(pageOverflows).toBe(false);
  });
}
