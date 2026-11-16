import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
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
