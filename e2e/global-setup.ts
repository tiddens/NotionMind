import type { FullConfig } from '@playwright/test';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup(config: FullConfig) {
  const mapsDirectory = path.resolve(config.metadata.mapsDirectory);
  // Only remove the temporary directory explicitly allocated for this test run.
  if (path.dirname(mapsDirectory) !== path.resolve(tmpdir()) ||
      !/^notionmind-e2e-[0-9a-f-]{36}$/.test(path.basename(mapsDirectory))) {
    throw new Error('Invalid E2E maps directory');
  }

  const cleanup = () => rm(mapsDirectory, { recursive: true, force: true });
  try {
    // Playwright starts the isolated server before calling globalSetup.
    await mkdir(mapsDirectory, { recursive: true });
    await copyFile(
      fileURLToPath(new URL('../maps/getting-started.md', import.meta.url)),
      path.join(mapsDirectory, 'getting-started.md'),
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
  return cleanup;
}
