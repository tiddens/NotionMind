import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mapsDirectory = path.join(tmpdir(), `notionmind-e2e-${randomUUID()}`);
const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  metadata: { mapsDirectory },
  timeout: 30000,
  use: {
    baseURL,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run build && npm run server',
    url: baseURL,
    env: { PORT: '4173', HOST: '127.0.0.1', NOTIONMIND_DIR: mapsDirectory },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
