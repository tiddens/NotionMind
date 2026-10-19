import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

async function visibleCaret(page: Page) {
  const visible = (await page.screenshot({ caret: 'initial' })).toString('base64');
  const hidden = (await page.screenshot({ caret: 'hide' })).toString('base64');
  return page.evaluate(async ({ visible, hidden }) => {
    const pixels = async (base64: string) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width };
    };
    const [shown, blank] = await Promise.all([pixels(visible), pixels(hidden)]);
    let x = Infinity, y = Infinity, count = 0;
    for (let index = 0; index < shown.data.length; index += 4) {
      if (Math.abs(shown.data[index] - blank.data[index]) + Math.abs(shown.data[index + 1] - blank.data[index + 1]) + Math.abs(shown.data[index + 2] - blank.data[index + 2]) > 80) {
        x = Math.min(x, (index / 4) % shown.width);
        y = Math.min(y, Math.floor(index / 4 / shown.width));
        count++;
      }
    }
    return { x, y, count };
  }, { visible, hidden });
}

const test = base.extend<{ cursorMap: string }>({
  cursorMap: async ({ page, request }, runTest) => {
    const filename = `/api/files/z-e2e-cursor-${randomUUID()}.md`;
    expect((await request.post(filename, {
      headers: { 'Content-Type': 'text/plain' },
      data: '# Cursor regression\n\n## Editable note\n\n## Another note\n',
    })).ok()).toBe(true);
    try {
      await page.goto('/');
      await page.getByText(filename.split('/').at(-1)!.slice(0, -3), { exact: true }).click();
      await expect(page.locator('svg text').filter({ hasText: /^Editable note$/ })).toBeVisible();
      await runTest(filename);
    } finally {
      await page.close();
      await request.delete(filename);
      await request.delete(`${filename}.meta.json`);
    }
  },
});

test('double-clicking a word keeps the draft and text selection', async ({ page, cursorMap }) => {
  expect(cursorMap).toContain('z-e2e-cursor-');
  const caption = page.locator('svg text').filter({ hasText: /^Editable note$/ });
  await caption.locator('..').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit node text' });
  const draft = 'Keep this unsaved text and select a word';
  await editor.fill(draft);
  await editor.dblclick({ position: { x: 20, y: 10 } });
  await expect(editor).toHaveValue(draft);
  const selection = await editor.evaluate((element: HTMLTextAreaElement) => ({
    start: element.selectionStart, end: element.selectionEnd,
  }));
  expect(selection.end - selection.start).toBeGreaterThan(0);
  await editor.pressSequentially('replacement');
  await expect(editor).toHaveValue(draft.slice(0, selection.start) + 'replacement' + draft.slice(selection.end));
  await expect(editor).toBeFocused();
});

test('typing in the middle of a zoomed node preserves the caret', async ({ page, cursorMap }) => {
  expect(cursorMap).toContain('z-e2e-cursor-');
  const controls = page.getByRole('group', { name: 'Mind map zoom controls' });
  await controls.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const caption = page.locator('svg text').filter({ hasText: /^Editable note$/ });
  await caption.locator('..').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit node text' });
  const draft = 'First sentence. ' + 'Long wrapped node text. '.repeat(8);
  await editor.fill(draft);
  await editor.press('Control+Home');
  await editor.press('ArrowRight');
  await editor.pressSequentially('XYZ');
  await expect(editor).toHaveValue(draft.slice(0, 1) + 'XYZ' + draft.slice(1));
  expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(4);
  await expect(editor).toBeFocused();
});

test('the caret matches the text and stays aligned when zooming and resizing', async ({ page, cursorMap }, testInfo) => {
  expect(cursorMap).toContain('z-e2e-cursor-');
  const canvas = page.getByRole('region', { name: 'Mind map canvas' });
  const node = canvas.locator('svg > g').first();
  await node.dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit node text' });
  await editor.press('Control+End');
  const selection = await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart);
  await expect(editor).toHaveCSS('caret-color', 'rgb(255, 255, 255)');
  await expect(editor).toHaveCSS('cursor', 'text');
  await expect(node.locator('text')).toHaveCount(0);

  const expectAligned = async () => {
    await expect.poll(async () => {
      const card = (await node.locator(':scope > rect').first().boundingBox())!;
      const input = (await editor.boundingBox())!;
      return input.x >= card.x && input.y >= card.y &&
        input.x + input.width <= card.x + card.width + 1 &&
        input.y + input.height <= card.y + card.height + 1;
    }).toBe(true);
    await expect(editor).toBeFocused();
    expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(selection);
  };
  await expectAligned();
  const before = (await editor.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(before.width);
  } finally {
    await page.keyboard.up('Control');
  }
  await expectAligned();
  await page.setViewportSize({ width: 1000, height: 760 });
  await expectAligned();
  await page.screenshot({ path: testInfo.outputPath('aligned-text-caret.png'), caret: 'initial' });
});

test('long drafts keep every line visible and do not move the editor while typing', async ({ page, request, cursorMap }, testInfo) => {
  expect(cursorMap).toContain('z-e2e-cursor-');
  const draft = 'Planning    product development     customer success    '.repeat(12) + 'https://example.com/' + 'long-address-'.repeat(12);
  expect((await request.post(cursorMap, {
    headers: { 'Content-Type': 'text/plain' },
    data: `# Cursor regression\n\n## ${draft}\n\n## Another note\n`,
  })).ok()).toBe(true);
  await page.reload();
  await page.getByText(cursorMap.split('/').at(-1)!.slice(0, -3), { exact: true }).click();
  await page.getByRole('group', { name: 'Mind map zoom controls' }).getByRole('button', { name: 'Zoom in', exact: true }).click();
  const caption = page.locator('svg text').filter({ hasText: 'Planning' });
  await caption.locator('..').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit node text' });
  await editor.fill(draft);
  await editor.press('Control+End');
  await expect.poll(() => editor.evaluate(element => ({
    fits: element.scrollHeight <= element.clientHeight + 1,
    top: element.scrollTop,
    left: element.scrollLeft,
  }))).toEqual({ fits: true, top: 0, left: 0 });

  const before = (await editor.boundingBox())!;
  await editor.pressSequentially(' and even more text to keep on the next line');
  const after = (await editor.boundingBox())!;
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  await expect.poll(() => editor.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await editor.press('Control+Home');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBe(0);
  await editor.press('Control+End');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBe(0);
  await expect(editor).toBeFocused();
  const canvas = page.getByRole('region', { name: 'Mind map canvas' });
  const card = (await canvas.locator('svg > g').nth(1).locator(':scope > rect').last().boundingBox())!;
  const field = (await editor.boundingBox())!;
  expect(field.x).toBeGreaterThanOrEqual(card.x);
  expect(field.y).toBeGreaterThanOrEqual(card.y);
  expect(field.x + field.width).toBeLessThanOrEqual(card.x + card.width + 1);
  expect(field.y + field.height).toBeLessThanOrEqual(card.y + card.height + 1);
  expect(await canvas.evaluate(element => element.scrollLeft)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('long-draft-editor.png'), caret: 'initial' });
  await editor.press('Escape');
  await expect(caption).toBeVisible();
});

test('very long drafts scroll inside the editor and shrink cleanly after deletion', async ({ page, cursorMap }, testInfo) => {
  expect(cursorMap).toContain('z-e2e-cursor-');
  await page.setViewportSize({ width: 1000, height: 600 });
  const canvas = page.getByRole('region', { name: 'Mind map canvas' });
  const caption = canvas.locator('svg text').filter({ hasText: /^Editable note$/ });
  await caption.locator('..').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit node text' });
  const draft = 'Financial planning    product development    customer success. '.repeat(100);
  await editor.fill(draft);
  await expect.poll(() => editor.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await editor.evaluate(element => element.clientHeight / Number.parseFloat(getComputedStyle(element).lineHeight))).toBeGreaterThan(3);
  await editor.press('Control+Home');
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(1);

  const transform = await canvas.locator('svg').getAttribute('style');
  const field = (await editor.boundingBox())!;
  await page.mouse.move(field.x + field.width / 2, field.y + field.height / 2);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await canvas.locator('svg').getAttribute('style')).toBe(transform);
  await editor.press('Control+End');
  await expect.poll(() => editor.evaluate(element => Math.abs(element.scrollTop + element.clientHeight - element.scrollHeight))).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('scrollable-long-editor.png'), caret: 'initial' });

  await editor.fill('even');
  await expect.poll(() => editor.evaluate(element => ({
    fits: element.scrollHeight <= element.clientHeight + 1, top: element.scrollTop, left: element.scrollLeft,
  }))).toEqual({ fits: true, top: 0, left: 0 });
  await editor.fill('');
  await editor.pressSequentially('A fresh sentence');
  await expect(editor).toHaveValue('A fresh sentence');
  await expect(editor).toBeFocused();
  await editor.press('Escape');
  await expect(caption).toBeVisible();
});

for (const label of ['Cursor regression', 'Editable note']) {
  test(`spaces advance the visible caret in ${label === 'Cursor regression' ? 'root' : 'branch'} text`, async ({ page, cursorMap }) => {
    expect(cursorMap).toContain('z-e2e-cursor-');
    await page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').dblclick();
    const editor = page.getByRole('textbox', { name: 'Edit node text' });
    await editor.evaluate(element => {
      element.spellcheck = false;
      element.style.setProperty('caret-animation', 'manual');
    });
    await editor.fill('word');
    await editor.press('End');
    let before = await visibleCaret(page);
    expect(before.count).toBeGreaterThan(0);
    for (let index = 1; index <= 3; index++) {
      await editor.press('Space');
      await expect(editor).toHaveValue('word' + ' '.repeat(index));
      expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(4 + index);
      const after = await visibleCaret(page);
      expect(after.count).toBeGreaterThan(0);
      expect(after.x).toBeGreaterThan(before.x);
      before = after;
    }
    await editor.pressSequentially('next');
    await expect(editor).toHaveValue('word   next');
  });

  test(`spaces advance the caret at a wrapped ${label === 'Cursor regression' ? 'root' : 'branch'} line`, async ({ page, cursorMap }) => {
    expect(cursorMap).toContain('z-e2e-cursor-');
    await page.locator('svg text').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').dblclick();
    const editor = page.getByRole('textbox', { name: 'Edit node text' });
    const line = await editor.evaluate(element => {
      element.spellcheck = false;
      element.style.setProperty('caret-animation', 'manual');
      const style = getComputedStyle(element);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return 'W'.repeat(Math.floor((element.clientWidth - 1) / context.measureText('W').width));
    });
    await editor.fill(line);
    await editor.press('End');
    let before = await visibleCaret(page);
    expect(before.count).toBeGreaterThan(0);
    for (let index = 1; index <= 5; index++) {
      await editor.press('Space');
      await expect(editor).toHaveValue(line + ' '.repeat(index));
      expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(line.length + index);
      const after = await visibleCaret(page);
      expect(after.count).toBeGreaterThan(0);
      expect(after.y > before.y || after.x > before.x).toBe(true);
      before = after;
    }
  });
}
