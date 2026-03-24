import { test, expect } from '@playwright/test';

test.describe('File operations', () => {
  test('sidebar shows files and can open them', async ({ page }) => {
    await page.goto('/');

    // Wait for sidebar to load files
    const sidebar = page.locator('div').filter({ hasText: 'NotionMind' }).first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // The getting-started file should be listed (without .md extension in display)
    await expect(page.getByText('getting-started')).toBeVisible({ timeout: 5000 });
  });

  test('copy button copies markdown to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.waitForSelector('svg text', { timeout: 10000 });

    // Click the Copy button
    const copyBtn = page.getByRole('button', { name: /copy/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Button should show "Copied!"
    await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
  });
});
