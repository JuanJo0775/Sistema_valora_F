import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { CATALOG_PRODUCT, FEATURED_WITHOUT_LOCATION } from './src/pwa/catalogCache';
import { MANIFEST } from './src/pwa/manifest';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      // ADR-017: la app se instala en el celular. Solo se guardan en caché los archivos de la app;
      // las consultas a /v1 van a la red (la consulta requiere conexión, ADR-010). La única excepción
      // es el detalle de un producto ya abierto, para registrar sin señal (#26), y la canasta básica
      // sin ubicación (H-08). Nada con ubicación ni con sesión se guarda aquí (EC-08).
      VitePWA({
        // Aviso de versión nueva (UpdateBanner): se actualiza cuando la persona lo pide.
        registerType: 'prompt',
        includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
        manifest: MANIFEST,
        workbox: {
          // Las fuentes y los íconos también, para que la app abra igual sin internet.
          globPatterns: ['**/*.{js,css,html,png,woff2}'],
          navigateFallbackDenylist: [/^\/v1\//],
          runtimeCaching: [
            {
              urlPattern: CATALOG_PRODUCT,
              // Red primero: con señal siempre el catálogo al día; sin señal, el último que se vio.
              handler: 'NetworkFirst',
              options: {
                cacheName: 'catalogo',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: FEATURED_WITHOUT_LOCATION,
              // Lo último al instante y se actualiza por detrás; solo GET, solo respuestas 200.
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'canasta-basica',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
          ],
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
