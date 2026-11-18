// Manifest de la PWA (ADR-017). Lo usa vite.config.ts; vive aquí para poder probarlo.
const shortcutIcons = [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }];

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
  // Prototipo MC-E4: superficies blancas; el naranja solo para la acción principal.
  background_color: '#FFFFFF',
  theme_color: '#FFFFFF',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  // Atajos al mantener pulsado el ícono de la app.
  shortcuts: [
    { name: 'Registrar precio', url: '/registrar', icons: shortcutIcons },
    { name: 'Mapa', url: '/mapa', icons: shortcutIcons },
    { name: 'Canasta', url: '/canasta', icons: shortcutIcons },
  ],
};
