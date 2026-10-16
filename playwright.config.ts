import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8790',
    viewport: { width: 1440, height: 960 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/wrangler.mjs dev --port 8790 --ip 127.0.0.1 --local --persist-to .wrangler/test-state',
    url: 'http://127.0.0.1:8790/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
