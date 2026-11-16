import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      // ADR-017: la app se instala en el celular. Solo se guardan en caché los archivos de la app;
      // las consultas a /v1 siempre van a la red (la consulta requiere conexión, ADR-010). La cola
      // sin conexión del registro llega con la #26.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Valora — precios de tu barrio',
          short_name: 'Valora',
          description:
            'Compara precios de tiendas de barrio, minimercados y supermercados de Armenia y el Quindío.',
          lang: 'es-CO',
          start_url: '/',
          display: 'standalone',
          // Prototipo MC-E4: superficies blancas; el naranja solo para la acción principal.
          background_color: '#FFFFFF',
          theme_color: '#FFFFFF',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Las fuentes y los íconos también, para que la app abra igual sin internet.
          globPatterns: ['**/*.{js,css,html,png,woff2}'],
          navigateFallbackDenylist: [/^\/v1\//],
        },
      }),
    ],
    server: {
      // El navegador habla con un solo sitio: /v1 se reenvía al backend. Así la cookie de sesión
      // (SameSite=Lax) funciona. En producción hará lo mismo un rewrite de Vercel (ADR-012).
      proxy: { '/v1': env['API_PROXY_TARGET'] ?? 'http://localhost:3000' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.spec.{ts,tsx}'],
        thresholds: { lines: 80 },
      },
    },
  };
});
