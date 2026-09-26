import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'bun run build && bun run preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 400, height: 860 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin'
  }
});
