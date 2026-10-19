import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectWrappedInsideCard(caption: Locator) {
  const geometry = await caption.evaluate((element: SVGTextElement) => {
    const background = element.parentElement!.querySelector(':scope > rect') as SVGRectElement;
    const lines = [...element.querySelectorAll('tspan')].map(line => {
      const box = line.getBBox();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    return { width: background.width.baseVal.value, height: background.height.baseVal.value, lines };
  });
  expect(geometry.width).toBeLessThanOrEqual(600);
  expect(geometry.lines.length).toBeGreaterThan(1);
  expect(geometry.height).toBeGreaterThan(34);
  for (const line of geometry.lines) {
    expect(line.x).toBeGreaterThanOrEqual(8);
    expect(line.x + line.width).toBeLessThanOrEqual(geometry.width - 8);
    expect(line.y).toBeGreaterThanOrEqual(3);
    expect(line.y + line.height).toBeLessThanOrEqual(geometry.height - 3);
  }
}

test('long root and branch text wrap inside their cards, including while editing', async ({ page, request }, testInfo) => {
  const name = `z-e2e-wrapping-${randomUUID()}`;
  const rootText = 'Downscale the company and focus on product development, marketing and customer success. '.repeat(14).trim();
  const branchText = 'Review investment plans and validate customer demand before expanding the team. '.repeat(12).trim();
  const url = 'https://example.com/' + 'very-long-unbroken-address-'.repeat(35);
  const filename = `/api/files/${name}.md`;
  expect((await request.post(filename, {
    headers: { 'Content-Type': 'text/plain' },
    data: `# ${rootText}\n\n## ${branchText}\n\n## ${url}\n`,
  })).ok()).toBe(true);
  try {
    await page.goto('/');
    await page.getByText(name, { exact: true }).click();
    const root = page.locator('svg text[aria-label]').filter({ hasText: 'Downscale the company' });
    const branch = page.locator('svg text[aria-label]').filter({ hasText: 'Review investment plans' });
    const address = page.locator('svg text[aria-label]').filter({ hasText: 'https://example.com/' });
    await expect(root).toBeVisible();
    await expectWrappedInsideCard(root);
    await expectWrappedInsideCard(branch);
    await expectWrappedInsideCard(address);
    await page.screenshot({ path: testInfo.outputPath('wrapped-nodes.png') });

    await root.locator('..').dblclick();
    const editor = page.getByRole('textbox', { name: 'Edit node text' });
    await expect(editor).toBeFocused();
    const editedText = rootText + ' Keep the plan readable and preserve every word.'.repeat(8);
    await editor.fill(editedText);
    await expect.poll(() => editor.evaluate(element => ({
      fits: element.scrollHeight <= element.clientHeight + 1,
      wraps: element.clientHeight > 34,
    }))).toEqual({ fits: true, wraps: true });
    await editor.press('Enter');
    await expect(editor).not.toBeVisible();
    await expectWrappedInsideCard(root);
    const saved = page.waitForResponse(response => response.url().endsWith(filename) && response.request().method() === 'POST');
    await page.keyboard.press('Control+s');
    expect((await saved).ok()).toBe(true);
    expect(await (await request.get(filename)).text()).toContain(`# ${editedText}\n`);
  } finally {
    await page.close();
    await request.delete(filename);
    await request.delete(`${filename}.meta.json`);
  }
});
