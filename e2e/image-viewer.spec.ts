import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import type { Locator } from '@playwright/test';

const ROOT_TEXT = 'Image map root';
const BRANCH_TEXT = 'Landscape photo';

const test = base.extend<{
  imageMap: { name: string; markdown: string };
  imageSize: { width: number; height: number };
}>({
  imageSize: [{ width: 1200, height: 800 }, { option: true }],
  imageMap: async ({ page, request, imageSize }, runTest) => {
    await page.goto('/');
    const png = await page.evaluate(({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#9bd5ff';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#225588';
      context.fillRect(width / 6, height * 0.1875, width * 2 / 3, height * 0.625);
      return canvas.toDataURL('image/png').split(',')[1];
    }, imageSize);
    const upload = await request.post('/api/images', {
      headers: { 'Content-Type': 'image/png' },
      data: Buffer.from(png, 'base64'),
    });
    expect(upload.ok()).toBe(true);
    const { filename } = await upload.json() as { filename: string };
    // Sort after the sample so parallel tests retain their usual startup map.
    const name = `z-e2e-images-${randomUUID()}`;
    const markdown = `# ${ROOT_TEXT}\n\n![Root](${filename})\n\n## ${BRANCH_TEXT}\n\n![Landscape](${filename})\n\n## Keyboard sentinel\n`;
    try {
      const created = await request.post(`/api/files/${name}.md`, {
        headers: { 'Content-Type': 'text/plain' },
        data: markdown,
      });
      expect(created.ok()).toBe(true);
      await page.reload();
      await expect(page.locator('svg text').filter({ hasText: /^Getting Started$/ })).toBeVisible();
      await page.getByText(name, { exact: true }).click();
      await expect(page.locator('svg text').filter({ hasText: /^Image map root$/ })).toBeVisible();
      await runTest({ name, markdown });
    } finally {
      // Stop any pending browser autosave before deleting this test's fixtures.
      await page.close();
      await request.delete(`/api/files/${name}.md`);
      await request.delete(`/api/files/${name}.md.meta.json`);
      await request.delete(`/api/images/${filename}`);
    }
  },
});

function zoomPercent(dialog: Locator) {
  return dialog.getByText(/^\d+(?:\.\d+)?%$/);
}

async function readZoom(dialog: Locator) {
  return Number.parseFloat((await zoomPercent(dialog).textContent())!);
}

for (const nodeText of [ROOT_TEXT, BRANCH_TEXT]) {
  test(`opens the ${nodeText === ROOT_TEXT ? 'root' : 'branch'} image in a full-window viewer`, async ({ page, imageMap }, testInfo) => {
    expect(imageMap.name).toMatch(/^z-e2e-images-/);
    const thumbnail = page.getByRole('button', { name: `View image: ${nodeText}`, exact: true });
    await thumbnail.focus();
    await thumbnail.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
    await expect(dialog).toBeVisible();
    const image = dialog.getByRole('img', { name: nodeText, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => ({
      complete: element.complete,
      width: element.naturalWidth,
      height: element.naturalHeight,
    }))).toEqual({ complete: true, width: 1200, height: 800 });
    await expect(zoomPercent(dialog)).toHaveText('100%');

    const dialogBox = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(dialogBox!.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(dialogBox!.height).toBeGreaterThanOrEqual(viewport.height - 2);
    if (nodeText === BRANCH_TEXT) {
      await page.screenshot({ path: testInfo.outputPath('image-viewer.png') });
    }

    await dialog.getByRole('button', { name: 'Close image viewer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(thumbnail).toBeFocused();
    if (nodeText === BRANCH_TEXT) {
      await page.screenshot({ path: testInfo.outputPath('map-image-previews.png') });
    }
  });
}

test('zooms with buttons and wheel, pans, fits, and resets when reopened', async ({ page, imageMap }) => {
  expect(imageMap.name).toMatch(/^z-e2e-images-/);
  const thumbnail = page.getByRole('button', { name: `View image: ${BRANCH_TEXT}`, exact: true });
  await thumbnail.click();
  const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
  const image = dialog.getByRole('img', { name: BRANCH_TEXT, exact: true });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1200);
  const fitBox = (await image.boundingBox())!;

  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(() => readZoom(dialog)).toBeGreaterThan(100);
  const enlargedZoom = await readZoom(dialog);
  await expect.poll(async () => (await image.boundingBox())!.width).toBeGreaterThan(fitBox.width);
  await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect.poll(() => readZoom(dialog)).toBeLessThan(enlargedZoom);

  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const beforeWheel = await readZoom(dialog);
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => readZoom(dialog)).toBeGreaterThan(beforeWheel);
  expect(await readZoom(dialog)).toBeLessThanOrEqual(800);

  const beforePan = (await image.boundingBox())!;
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 + 70, viewport.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await image.boundingBox())!.x - beforePan.x)).toBeGreaterThan(10);
  await expect.poll(async () => Math.abs((await image.boundingBox())!.y - beforePan.y)).toBeGreaterThan(10);

  await dialog.getByRole('button', { name: 'Fit to screen', exact: true }).click();
  await expect(zoomPercent(dialog)).toHaveText('100%');
  await expect.poll(async () => (await image.boundingBox())!.width).toBeCloseTo(fitBox.width, 0);
  await expect.poll(async () => (await image.boundingBox())!.x).toBeCloseTo(fitBox.x, 0);
  await expect.poll(async () => (await image.boundingBox())!.y).toBeCloseTo(fitBox.y, 0);

  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close image viewer', exact: true }).click();
  await thumbnail.click();
  await expect(zoomPercent(dialog)).toHaveText('100%');
  await expect.poll(async () => (await image.boundingBox())!.width).toBeCloseTo(fitBox.width, 0);
  await expect.poll(async () => (await image.boundingBox())!.x).toBeCloseTo(fitBox.x, 0);
});

test('enters and exits browser full screen, and exits full screen when closed', async ({ page, imageMap }, testInfo) => {
  expect(imageMap.name).toMatch(/^z-e2e-images-/);
  const thumbnail = page.getByRole('button', { name: `View image: ${BRANCH_TEXT}`, exact: true });
  await thumbnail.click();
  const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
  const image = dialog.getByRole('img', { name: BRANCH_TEXT, exact: true });
  await expect(image).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  await dialog.getByRole('button', { name: 'Enter full screen', exact: true }).click();
  await expect.poll(() => dialog.evaluate(element =>
    document.fullscreenElement !== null && element.contains(document.fullscreenElement),
  )).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
  await expect(image).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('browser-fullscreen-viewer.png') });

  await dialog.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(dialog).toBeVisible();
  await expect(image).toBeVisible();

  await dialog.getByRole('button', { name: 'Enter full screen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await dialog.getByRole('button', { name: 'Close image viewer', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(thumbnail).toBeFocused();
});

test('shows a failed image clearly and disables zoom without trapping the user', async ({ page, imageMap }) => {
  expect(imageMap.name).toMatch(/^z-e2e-images-/);
  const thumbnail = page.getByRole('button', { name: `View image: ${BRANCH_TEXT}`, exact: true });
  await expect(thumbnail).toBeVisible();
  await page.route('**/api/images/*', route => route.fulfill({
    status: 404,
    contentType: 'text/plain',
    body: 'Missing test image',
  }));
  await thumbnail.click();
  const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
  await expect(dialog.getByRole('alert')).toHaveText('This image could not be loaded.');
  await expect(dialog.locator('img')).toBeHidden();
  for (const name of ['Zoom in', 'Zoom out', 'Fit to screen']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await expect(zoomPercent(dialog)).toHaveText('100%');
  await dialog.getByRole('button', { name: 'Close image viewer', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(thumbnail).toBeFocused();
});

test('traps focus and keeps map shortcuts inactive until Escape closes the viewer', async ({ page, request, imageMap }) => {
  const thumbnail = page.getByRole('button', { name: `View image: ${BRANCH_TEXT}`, exact: true });
  const originalNodeText = await page.locator('svg text').allTextContents();
  const originalImageCount = await page.locator('svg image').count();
  await thumbnail.focus();
  await thumbnail.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
  await expect(dialog).toBeVisible();

  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(key);
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
  }
  for (const key of ['Insert', 'Delete', 'F2', 'x', 'Control+ArrowRight', 'Control+z']) {
    await page.keyboard.press(key);
  }
  await expect(page.getByRole('textbox', { name: 'Edit node text' })).toHaveCount(0);
  await expect(page.locator('svg image')).toHaveCount(originalImageCount);

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(thumbnail).toBeFocused();
  expect(await page.locator('svg text').allTextContents()).toEqual(originalNodeText);
  const persisted = await request.get(`/api/files/${imageMap.name}.md`);
  expect(await persisted.text()).toBe(imageMap.markdown);
});

test.describe('Wide image previews', () => {
  test.use({ imageSize: { width: 1200, height: 150 } });

  test('fits root and branch cards to a wide image without large blank gaps or cropping', async ({ page, imageMap }, testInfo) => {
    expect(imageMap.name).toMatch(/^z-e2e-images-/);
    for (const nodeText of [ROOT_TEXT, BRANCH_TEXT]) {
      const title = page.locator('svg text').filter({ hasText: new RegExp(`^${nodeText}$`) });
      const node = title.locator('..');
      const preview = node.locator('image');
      const background = node.locator(':scope > rect').first();
      await expect(preview).toBeVisible();
      // The image element itself must match the source aspect ratio; a fixed
      // tall SVG image box would still hide excess space behind "meet" sizing.
      await expect.poll(() => preview.evaluate((element: SVGImageElement) =>
        element.width.baseVal.value / element.height.baseVal.value,
      )).toBeCloseTo(8, 1);

      const titleBox = (await title.boundingBox())!;
      const previewBox = (await preview.boundingBox())!;
      const cardBox = (await background.boundingBox())!;
      expect(cardBox.height).toBeLessThan(titleBox.height * 5);
      expect(previewBox.y - (titleBox.y + titleBox.height)).toBeGreaterThanOrEqual(0);
      expect(previewBox.y - (titleBox.y + titleBox.height)).toBeLessThan(titleBox.height * 1.5);
      expect(cardBox.y + cardBox.height - (previewBox.y + previewBox.height)).toBeGreaterThanOrEqual(-1);
      expect(cardBox.y + cardBox.height - (previewBox.y + previewBox.height)).toBeLessThan(titleBox.height);

      await page.getByRole('button', { name: `View image: ${nodeText}`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Image viewer', exact: true });
      const image = dialog.getByRole('img', { name: nodeText, exact: true });
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => ({
        width: element.naturalWidth,
        height: element.naturalHeight,
      }))).toEqual({ width: 1200, height: 150 });
      const viewerImageBox = (await image.boundingBox())!;
      expect(viewerImageBox.width / viewerImageBox.height).toBeCloseTo(8, 1);
      if (nodeText === BRANCH_TEXT) {
        await page.screenshot({ path: testInfo.outputPath('wide-image-viewer.png') });
      }
      await dialog.getByRole('button', { name: 'Close image viewer', exact: true }).click();
    }
    await page.screenshot({ path: testInfo.outputPath('wide-map-previews.png') });
  });
});
