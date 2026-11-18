// Manifest de la PWA (ADR-017). Lo usa vite.config.ts; vive aquí para poder probarlo.
const DARK = '#0D0D0E';
const shortcutIcons = [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }];

const shot = (name: string, sizes: string, form_factor: 'narrow' | 'wide', label: string) => ({
  src: `screenshots/${name}.png`,
  sizes,
  type: 'image/png',
  form_factor,
  label,
});

export const MANIFEST = {
  // Identidad estable de la app instalada, aunque cambie la dirección de inicio.
  id: '/',
  name: 'Valora — precios de tu barrio',
  short_name: 'Valora',
  description:
    'Compara precios de tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.',
  lang: 'es-CO',
  categories: ['shopping', 'food', 'lifestyle'],
  start_url: '/',
  display: 'standalone' as const,
  // H-25: el manifest admite un solo color de cada uno (no hay variante por tema), así que se elige
  // el del tema oscuro, el de --bg en tokens.css: la app instalada abre sin el destello blanco de
  // la pantalla de arranque. En el navegador, index.html trae dos «theme-color» con `media`
  // (claro #FFFFFF y oscuro #0D0D0E) y esos mandan sobre el del manifest en cada tema.
  background_color: DARK,
  theme_color: DARK,
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  // H-25: capturas reales de la app compilada (Playwright) para la ventana de instalación: celular
  // (1080x1920) y escritorio (1920x1080). Cada una pesa menos de 300 kB. No se precachean.
  screenshots: [
    shot('inicio-narrow', '1080x1920', 'narrow', 'Inicio: la canasta básica de hoy en Armenia'),
    shot('detalle-narrow', '1080x1920', 'narrow', 'Detalle de un producto: el precio más barato'),
    shot('inicio-wide', '1920x1080', 'wide', 'Inicio: la canasta básica de hoy en Armenia'),
    shot('detalle-wide', '1920x1080', 'wide', 'Detalle de un producto: todas las tiendas'),
  ],
  // Atajos al mantener pulsado el ícono de la app.
  shortcuts: [
    { name: 'Registrar precio', url: '/registrar', icons: shortcutIcons },
    { name: 'Mapa', url: '/mapa', icons: shortcutIcons },
    { name: 'Canasta', url: '/canasta', icons: shortcutIcons },
  ],
};
