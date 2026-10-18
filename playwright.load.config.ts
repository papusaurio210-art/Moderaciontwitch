import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/load',
  timeout: 180_000,
  outputDir: 'test-results/load',
  webServer: {
    ...base.webServer,
    command: 'node scripts/wrangler.mjs dev --port 8790 --ip 127.0.0.1 --local --persist-to .wrangler/load-state',
  },
});
