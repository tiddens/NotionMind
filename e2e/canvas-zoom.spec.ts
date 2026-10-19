import { expect, test } from '@playwright/test';

test('Ctrl+wheel zooms toward the pointer and cancels browser zoom', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Mind map canvas' });
  const root = canvas.locator('text').filter({ hasText: /^Getting Started$/ });
  const controls = canvas.getByRole('group', { name: 'Mind map zoom controls' });
  const level = controls.getByRole('button', { name: 'Reset mind map view' });
  await expect(root).toBeVisible();
  const browserBefore = await page.evaluate(() => ({
    pixelRatio: devicePixelRatio, width: innerWidth, scale: visualViewport?.scale,
  }));
  await canvas.evaluate(element => {
    window.addEventListener('wheel', event => {
      if (event.ctrlKey) element.setAttribute('data-wheel-cancelled', String(event.defaultPrevented));
    });
  });
  const initial = (await root.boundingBox())!;
  const x = initial.x + initial.width / 2;
  const y = initial.y + initial.height / 2;
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -120);
    await expect(level).not.toHaveText('100%');
    await expect(canvas).toHaveAttribute('data-wheel-cancelled', 'true');
    const enlarged = (await root.boundingBox())!;
    expect(enlarged.width).toBeGreaterThan(initial.width);
    expect(enlarged.x + enlarged.width / 2).toBeCloseTo(x, 0);
    expect(enlarged.y + enlarged.height / 2).toBeCloseTo(y, 0);
    expect(await page.evaluate(() => ({
      pixelRatio: devicePixelRatio, width: innerWidth, scale: visualViewport?.scale,
    }))).toEqual(browserBefore);

    await page.mouse.wheel(0, 120);
    await expect(level).toHaveText('100%');
    await expect.poll(async () => (await root.boundingBox())!.width).toBeCloseTo(initial.width, 0);
  } finally {
    await page.keyboard.up('Control');
  }
});

test('zoom buttons work with the keyboard, respect limits, and reset the view', async ({ page }, testInfo) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Mind map canvas' });
  const controls = canvas.getByRole('group', { name: 'Mind map zoom controls' });
  const plus = controls.getByRole('button', { name: 'Zoom in', exact: true });
  const minus = controls.getByRole('button', { name: 'Zoom out', exact: true });
  const reset = controls.getByRole('button', { name: 'Reset mind map view' });
  const root = canvas.locator('text').filter({ hasText: /^Getting Started$/ });
  await expect(root).toBeVisible();
  const initial = (await root.boundingBox())!;
  const originalText = await canvas.locator('text').allTextContents();
  await plus.focus();
  await plus.press('Enter');
  await expect(reset).toHaveText('125%');
  await expect(canvas.getByRole('textbox')).toHaveCount(0);
  expect(await canvas.locator('text').allTextContents()).toEqual(originalText);
  expect((await root.boundingBox())!.width).toBeGreaterThan(initial.width);
  await minus.click();
  await expect(reset).toHaveText('100%');

  // Plain wheel still pans, and the percentage button restores both pan and zoom.
  const region = (await canvas.boundingBox())!;
  await page.mouse.move(region.x + region.width / 2, region.y + region.height / 2);
  await page.mouse.wheel(40, 70);
  await expect.poll(async () => (await root.boundingBox())!.y).toBeCloseTo(initial.y - 70, 0);
  await expect(reset).toHaveText('100%');
  await plus.click();
  await reset.click();
  await expect.poll(async () => (await root.boundingBox())!.x).toBeCloseTo(initial.x, 0);
  await expect.poll(async () => (await root.boundingBox())!.y).toBeCloseTo(initial.y, 0);

  for (let index = 0; index < 8 && await plus.isEnabled(); index++) await plus.click();
  await expect(plus).toBeDisabled();
  await expect(reset).toHaveText('300%');
  for (let index = 0; index < 16 && await minus.isEnabled(); index++) await minus.click();
  await expect(minus).toBeDisabled();
  await expect(reset).toHaveText('20%');
  await reset.click();
  await expect(reset).toHaveText('100%');
  await expect(plus).toBeEnabled();
  await expect(minus).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('mind-map-zoom-controls.png') });
});
