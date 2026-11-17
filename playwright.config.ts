import { defineConfig, devices } from '@playwright/test';

// #27: pruebas de extremo a extremo contra el backend de verdad (B#17, EC-07). La app se compila y se
// sirve con `vite preview`, que reenvía /v1 al backend (API_PROXY_TARGET, por defecto el de local).
// El backend con su base y su semilla lo levanta la CI o la persona en local (README).
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  // Las pruebas comparten la base: una a la vez, en el orden de los archivos.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
