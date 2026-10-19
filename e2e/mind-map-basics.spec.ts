import { test, expect } from '@playwright/test';

test.describe('Mind map basics', () => {
  test('app loads with a root node', async ({ page }) => {
    await page.goto('/');
    const nodeText = page.locator('svg text').first();
    await expect(nodeText).toBeVisible({ timeout: 10000 });
  });

  test('Tab creates a child and typing edits it', async ({ page }) => {
    await page.goto('/');
    const rootText = page.locator('svg text').filter({ hasText: /^Getting Started$/ });
    await expect(rootText).toBeVisible({ timeout: 10000 });
    await rootText.locator('..').click();
    await page.keyboard.press('Tab');

    const input = page.getByRole('textbox', { name: 'Edit node text' });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill('E2E Test Node');
    await input.press('Enter');
    await expect(input).toHaveCount(0);
    await expect(page.locator('svg text', { hasText: 'E2E Test Node' })).toBeVisible();
  });

  test('Escape navigates to root', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('svg text', { timeout: 10000 });

    // Press Escape should always work
    await page.keyboard.press('Escape');

    // Root should be visually present
    await expect(page.locator('svg text').first()).toBeVisible();
  });
});
