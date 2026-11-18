// Manifest de la PWA (ADR-017). Lo usa vite.config.ts; vive aquí para poder probarlo.
const DARK = '#0D0D0E';
const shortcutIcons = [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }];

export const MANIFEST = {
  // Identidad estable de la app instalada, aunque cambie la dirección de inicio.
  id: '/',
  name: 'Valora — precios de tu barrio',
  short_name: 'Valora',
  description:
    'Compara precios de tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.',
  lang: 'es-CO',
  dir: 'ltr' as const,
  categories: ['shopping', 'food', 'lifestyle'],
  // La app vive en todo el sitio; start_url queda dentro de scope.
  scope: '/',
  start_url: '/',
  display: 'standalone' as const,
  // Si el navegador no entiende «standalone», cae a una ventana mínima y no a una pestaña.
  display_override: ['standalone', 'minimal-ui'] as ('standalone' | 'minimal-ui')[],
  // Que Chrome no sugiera una app de tienda en lugar de la PWA.
  prefer_related_applications: false,
  // H-25: el manifest admite un solo color de cada uno (no hay variante por tema), así que se elige
  // el del tema oscuro, el de --bg en tokens.css: la app instalada abre sin el destello blanco de
  // la pantalla de arranque. En el navegador, index.html trae dos «theme-color» con `media`
  // (claro #FFFFFF y oscuro #0D0D0E) y esos mandan sobre el del manifest en cada tema.
  background_color: DARK,
  theme_color: DARK,
  icons: [
    // «any» y «maskable» van en entradas separadas: mezclar ambos propósitos en un mismo ícono
    // recorta el logo en Android.
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  // Atajos al mantener pulsado el ícono de la app.
  shortcuts: [
    { name: 'Registrar precio', url: '/registrar', icons: shortcutIcons },
    { name: 'Mapa', url: '/mapa', icons: shortcutIcons },
    { name: 'Canasta', url: '/canasta', icons: shortcutIcons },
  ],
};
